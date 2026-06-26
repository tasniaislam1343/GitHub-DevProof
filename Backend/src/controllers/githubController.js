const { fetchGitHubProfile, fetchUserRepos, fetchRepoCommits, fetchRepoFileContent, runASTDetectorMulti } = require('../services/githubService');
const { findSimilarExternalRepos } = require('../services/crossRepoSearchService');
const { User, Candidate, GitHubAnalysis, Repository } = require('../models');
const { spawn } = require('child_process');
const path = require('path');

/**
 * Run the enhanced AST detector in "full analysis" mode.
 * Sends both internal code samples and external code samples
 * for comparison using MOSS-equivalent + DevProof Enhanced engines.
 */
const runFullAnalysis = (internalSamples, externalSamples) => {
    return new Promise((resolve) => {
        const pythonProcess = spawn('python3', [
            path.join(__dirname, '../services/ast_detector.py')
        ]);
        let result = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => { result += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });

        pythonProcess.on('close', () => {
            try {
                const parsed = JSON.parse(result);
                resolve(parsed);
            } catch (e) {
                resolve({
                    internal_analysis: { max_similarity: 0, avg_similarity: 0, pair_results: [], moss_max: 0, devproof_max: 0 },
                    cross_repo_analysis: { matches_found: 0, top_matches: [], overall_moss_score: 0, overall_devproof_score: 0 }
                });
            }
        });

        const payload = {
            full_analysis: {
                internal: internalSamples,
                external: externalSamples
            }
        };

        pythonProcess.stdin.write(JSON.stringify(payload));
        pythonProcess.stdin.end();
    });
};

const analyzeCandidate = async (req, res) => {
    const { username } = req.params;

    try {
        const profileData = await fetchGitHubProfile(username);
        const reposData = await fetchUserRepos(username);
        
        const totalRepos = reposData.length;
        const forkedRepos = reposData.filter(repo => repo.fork === true).length;
        const originalRepos = totalRepos - forkedRepos;
        const authorshipRatio = totalRepos > 0 ? (originalRepos / totalRepos) * 100 : 0;

        let totalRecentCommits = 0;
        
        const repoDataWithCommits = await Promise.all(reposData.map(async (repo) => {
            let commits = 0;
            if (!repo.fork) { 
                commits = await fetchRepoCommits(username, repo.name);
                totalRecentCommits += commits;
            }
            return { ...repo, commitCount: commits };
        }));

        // ============================================================
        // STEP 1: Fetch REAL code from user's original repos
        // ============================================================
        const originalReposList = reposData.filter(repo => !repo.fork);
        const reposToCheck = originalReposList.slice(0, 6);
        const codeSamples = [];
        
        for (const repo of reposToCheck) {
            const code = await fetchRepoFileContent(username, repo.name);
            if (code && code.trim().length > 20) {
                codeSamples.push({
                    repo: repo.name,
                    code: code,
                    language: repo.language || 'Unknown'
                });
            }
        }

        // ============================================================
        // STEP 2: Search for similar code across ALL of GitHub
        // ============================================================
        let externalCodeSamples = [];
        try {
            externalCodeSamples = await findSimilarExternalRepos(username, codeSamples);
        } catch (crossRepoError) {
            // Cross-repo search is best-effort — don't fail the whole analysis
            console.warn('Cross-repo search encountered an issue:', crossRepoError.message);
        }

        // ============================================================
        // STEP 3: Run the FULL analysis (internal + cross-repo)
        // Using both MOSS-equivalent and DevProof Enhanced engines.
        // ============================================================
        let fullResult;

        if (codeSamples.length >= 2 || externalCodeSamples.length > 0) {
            fullResult = await runFullAnalysis(codeSamples, externalCodeSamples);
        } else {
            fullResult = {
                internal_analysis: { max_similarity: 0, avg_similarity: 0, pair_results: [], moss_max: 0, devproof_max: 0 },
                cross_repo_analysis: { matches_found: 0, top_matches: [], overall_moss_score: 0, overall_devproof_score: 0 }
            };
        }

        const internalAnalysis = fullResult.internal_analysis || {};
        const crossRepoAnalysis = fullResult.cross_repo_analysis || {};

        // Originality score: combine internal + cross-repo results
        // Take the WORSE (higher similarity) of internal and cross-repo
        const internalMaxSim = internalAnalysis.devproof_max || internalAnalysis.max_similarity || 0;
        const crossRepoMaxSim = crossRepoAnalysis.overall_devproof_score || 0;
        const worstSimilarity = Math.max(internalMaxSim, crossRepoMaxSim);
        const originalityScore = Math.max(0, Math.round(100 - worstSimilarity));

        // Build per-repo breakdown for the frontend graph
        const repoBreakdown = repoDataWithCommits
            .filter(repo => !repo.fork)
            .slice(0, 8)
            .map(repo => ({
                name: repo.name,
                commits: repo.commitCount,
                language: repo.language || 'Unknown',
                stars: repo.stargazers_count || 0
            }));

        // Upgraded Suspicious Pattern Flag Logic
        let suspiciousFlag = "Clean";
        if (worstSimilarity > 85.00) {
            suspiciousFlag = `CRITICAL WARNING: High code similarity detected (${worstSimilarity.toFixed(1)}% structural match).`;
        } else if (worstSimilarity > 60.00) {
            suspiciousFlag = `Warning: Moderate code similarity detected (${worstSimilarity.toFixed(1)}% structural match).`;
        } else if (originalRepos > 3 && totalRecentCommits < 5) {
            suspiciousFlag = "Suspicious: High repo count but almost zero commit history. Possible code dumping.";
        } else if (forkedRepos > (originalRepos * 3)) {
            suspiciousFlag = "Suspicious: Abnormally high ratio of forked repositories.";
        }

        // Database Saving Logic
        const [user] = await User.findOrCreate({
            where: { email: `${profileData.login}@github-mock.com` },
            defaults: { name: profileData.name || profileData.login, user_type: 'candidate' }
        });

        const [candidate] = await Candidate.findOrCreate({
            where: { user_id: user.user_id }
        });

        const analysis = await GitHubAnalysis.create({
            candidate_id: candidate.user_id,
            github_id: profileData.id.toString(),
            github_username: profileData.login,
            authorship_ratio: authorshipRatio,
            total_repos: totalRepos,
            originality_score: originalityScore
        });

        const repoPromises = repoDataWithCommits.map(repo => {
            return Repository.create({
                analysis_id: analysis.analysis_id,
                repo_name: repo.name,
                is_forked: repo.fork,
                is_claimed_original: !repo.fork,
                language: repo.language || 'Unknown',
                commit_count: Number(repo.commitCount) || 0 
            });
        });
        await Promise.all(repoPromises);

        // Build code snippets for side-by-side frontend display
        // Pair each user repo with its BEST external match from the cross-repo analysis
        const topMatches = crossRepoAnalysis.top_matches || [];

        const codeSnippets = codeSamples.map(sample => {
            // Find the best cross-repo match for this specific user repo
            const bestMatch = topMatches
                .filter(m => m.user_repo === sample.repo)
                .sort((a, b) => b.devproof_similarity - a.devproof_similarity)[0];

            // Find the external code sample that corresponds to this match
            let matchedExternal = null;
            if (bestMatch) {
                // bestMatch.external_repo is "owner/repo" format
                const extOwner = bestMatch.external_repo.split('/')[0];
                const extRepo = bestMatch.external_repo.split('/')[1] || bestMatch.external_repo;
                const extSample = externalCodeSamples.find(
                    s => s.owner === extOwner && s.repo === extRepo
                );
                if (extSample) {
                    matchedExternal = {
                        repo: extSample.repo,
                        owner: extSample.owner,
                        url: extSample.url,
                        code: (extSample.code || '').substring(0, 2000),
                        moss_similarity: bestMatch.moss_similarity,
                        devproof_similarity: bestMatch.devproof_similarity
                    };
                }
            }

            return {
                repo: sample.repo,
                language: sample.language,
                code: sample.code.substring(0, 2000),
                matched_external: matchedExternal
            };
        });

        // Keep flat list for backward compatibility
        const externalSnippets = externalCodeSamples.map(sample => ({
            repo: sample.repo,
            owner: sample.owner,
            url: sample.url,
            code: (sample.code || '').substring(0, 2000)
        }));

        res.status(200).json({
            message: "Advanced Deep Analysis Complete!",
            candidate: profileData.login,
            analysis_results: {
                total_repos: totalRepos,
                original_repos: originalRepos,
                forked_repos: forkedRepos,
                total_recent_commits: totalRecentCommits,
                authorship_ratio: Math.round(authorshipRatio),
                originality_score: originalityScore,
                ast_structural_similarity: `${(internalAnalysis.max_similarity || 0)}%`,
                suspicious_pattern_flag: suspiciousFlag,
                repo_breakdown: repoBreakdown,
                similarity_details: internalAnalysis.pair_results || [],
                // Cross-repo analysis results
                cross_repo_analysis: {
                    external_matches_found: crossRepoAnalysis.matches_found || 0,
                    top_external_matches: (crossRepoAnalysis.top_matches || []).map(m => ({
                        user_repo: m.user_repo,
                        external_repo: m.external_repo,
                        external_url: m.external_url,
                        moss_similarity: m.moss_similarity,
                        devproof_similarity: m.devproof_similarity
                    })),
                    overall_moss_score: crossRepoAnalysis.overall_moss_score || 0,
                    overall_devproof_score: crossRepoAnalysis.overall_devproof_score || 0
                },
                // Dual engine summary
                engines: {
                    moss: {
                        internal_score: internalAnalysis.moss_max || 0,
                        cross_repo_score: crossRepoAnalysis.overall_moss_score || 0,
                        overall: Math.max(internalAnalysis.moss_max || 0, crossRepoAnalysis.overall_moss_score || 0)
                    },
                    devproof: {
                        internal_score: internalAnalysis.devproof_max || internalAnalysis.max_similarity || 0,
                        cross_repo_score: crossRepoAnalysis.overall_devproof_score || 0,
                        overall: worstSimilarity
                    }
                },
                // Code snippets for side-by-side UI display
                code_snippets: {
                    user_code: codeSnippets,
                    external_code: externalSnippets
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || "Failed to run GitHub analysis." });
    }
};

module.exports = {
    analyzeCandidate
};
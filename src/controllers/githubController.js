const { fetchGitHubProfile, fetchUserRepos, fetchRepoCommits, runASTDetector } = require('../services/githubService');
const { User, Candidate, GitHubAnalysis, Repository } = require('../models');

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

        // ==========================================
        // DEEP CODE ANALYSIS (The Python Trigger)
        // ==========================================
        
        // Simulating code fetched from the candidate's GitHub
        const candidateFile = `
            function calculateTotal(items) {
                let sum = 0;
                for(let i=0; i<items.length; i++) {
                    sum += items[i].price;
                }
                return sum;
            }
        `;

        // Simulating a known tutorial or copied source code
        const copiedSourceFile = `
            function getCartSum(cartArray) {
                // renamed variables, same structure!
                let total = 0; 
                for(let j=0; j<cartArray.length; j++) {
                    total += cartArray[j].price;
                }
                return total;
            }
        `;

        // Trigger the Python AST Engine!
        const plagiarismScore = await runASTDetector(candidateFile, copiedSourceFile);

        // ==========================================

        // Upgraded Suspicious Pattern Flag Logic
        let suspiciousFlag = "Clean";
        if (plagiarismScore > 85.00) {
            suspiciousFlag = `CRITICAL WARNING: Structural Plagiarism Detected (${plagiarismScore}% structural match with known source).`;
        } else if (originalRepos > 3 && totalRecentCommits < 5) {
            suspiciousFlag = "Suspicious: High repo count but almost zero commit history. Possible code dumping.";
        } else if (forkedRepos > (originalRepos * 3)) {
            suspiciousFlag = "Suspicious: Abnormally high ratio of forked repositories.";
        }

        // Database Saving Logic (Unchanged)
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
            total_repos: totalRepos
        });

        // Save Repositories with safe number conversion
        const repoPromises = repoDataWithCommits.map(repo => {
            return Repository.create({
                analysis_id: analysis.analysis_id,
                repo_name: repo.name,
                is_forked: repo.fork,
                is_claimed_original: !repo.fork,
                language: repo.language || 'Unknown',
                commit_count: Number(repo.commitCount) || 0 // Force it to be a Number
            });
        });
        await Promise.all(repoPromises);

        res.status(200).json({
            message: "Feature 2: Advanced Deep Analysis Complete!",
            candidate: profileData.login,
            analysis_results: {
                total_repos: totalRepos,
                original_repos: originalRepos,
                total_recent_commits: totalRecentCommits,
                ast_structural_similarity: `${plagiarismScore}%`,
                suspicious_pattern_flag: suspiciousFlag
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to run GitHub analysis." });
    }
};

module.exports = {
    analyzeCandidate
};
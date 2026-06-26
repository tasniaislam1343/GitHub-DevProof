const { User, Candidate, GitHubAnalysis, TrustScore, Repository } = require('../models');

const getRecruiterDashboard = async (req, res) => {
    try {
        // Fetch all candidates and inject their related User, Analysis, and Score data
        const candidates = await Candidate.findAll({
            include: [
                {
                    model: User,
                    attributes: ['name', 'email', 'github_username']
                },
                {
                    model: GitHubAnalysis,
                    attributes: ['total_repos', 'authorship_ratio', 'originality_score', 'github_username', 'analyzed_at', 'commit_consistency_score', 'language_growth_score']
                },
                {
                    model: TrustScore,
                    attributes: ['github_score', 'originality_score', 'alignment_score', 'completeness_score', 'calculated_at']
                }
            ]
        });

        // Format the data to make it easy for the React frontend to map
        const formattedDashboard = candidates.map(c => {
            // Get the latest trust score
            const scores = c.TrustScores || [];
            const latestScore = scores.length > 0 
                ? scores.sort((a, b) => new Date(b.calculated_at) - new Date(a.calculated_at))[0] 
                : null;
            
            const githubAnalysis = c.GitHubAnalysis;
            const scoreValue = latestScore ? latestScore.github_score : null;

            return {
                id: c.user_id,
                name: c.User?.name || 'Unknown',
                email: c.User?.email || '',
                github: githubAnalysis?.github_username || c.User?.github_username || '',
                total_repos: githubAnalysis?.total_repos || 0,
                originality: githubAnalysis?.originality_score || 0,
                authorship_ratio: githubAnalysis?.authorship_ratio || 0,
                trust_score: scoreValue !== null ? Math.round(scoreValue) : 'N/A',
                status: scoreValue !== null 
                    ? (scoreValue >= 80 ? 'Verified' : scoreValue >= 50 ? 'Review' : 'Flagged') 
                    : 'Pending Analysis',
                analyzed_at: githubAnalysis?.analyzed_at || null,
                score_calculated_at: latestScore?.calculated_at || null
            };
        });

        // Compute aggregate stats for recruiter overview
        const scored = formattedDashboard.filter(c => typeof c.trust_score === 'number');
        const avgScore = scored.length > 0 
            ? Math.round(scored.reduce((sum, c) => sum + c.trust_score, 0) / scored.length) 
            : 0;
        const verified = scored.filter(c => c.trust_score >= 80).length;
        const flagged = scored.filter(c => c.trust_score < 50).length;
        const pending = formattedDashboard.filter(c => c.status === 'Pending Analysis').length;

        res.status(200).json({ 
            success: true, 
            data: formattedDashboard,
            stats: {
                total_candidates: formattedDashboard.length,
                avg_trust_score: avgScore,
                verified_count: verified,
                flagged_count: flagged,
                pending_count: pending,
                review_count: scored.length - verified - flagged
            }
        });
    } catch (error) {
        console.error("Dashboard Fetch Error:", error);
        res.status(500).json({ error: "Failed to load recruiter dashboard data." });
    }
};

const getCandidateProfile = async (req, res) => {
    const { username } = req.params;
    try {
        // Get the latest analysis for this GitHub username
        const analysis = await GitHubAnalysis.findOne({
            where: { github_username: username },
            order: [['analyzed_at', 'DESC']]
        });

        if (!analysis) {
            return res.status(404).json({ error: 'No analysis found. Run GitHub Analysis first.' });
        }

        // Get repos for this analysis
        const repos = await Repository.findAll({
            where: { analysis_id: analysis.analysis_id },
            attributes: ['repo_name', 'is_forked', 'language', 'commit_count']
        });

        // Get trust scores for this candidate
        const trustScores = await TrustScore.findAll({
            where: { candidate_id: analysis.candidate_id },
            order: [['calculated_at', 'DESC']],
            limit: 5
        });

        const latestScore = trustScores.length > 0 ? trustScores[0] : null;

        // Language distribution from repos
        const langMap = {};
        let totalCommits = 0;
        repos.forEach(r => {
            const lang = r.language || 'Unknown';
            langMap[lang] = (langMap[lang] || 0) + 1;
            totalCommits += r.commit_count || 0;
        });
        const languages = Object.entries(langMap)
            .map(([name, count]) => ({ name, count, percent: Math.round((count / Math.max(repos.length, 1)) * 100) }))
            .sort((a, b) => b.count - a.count);

        res.status(200).json({
            success: true,
            profile: {
                username: analysis.github_username,
                total_repos: analysis.total_repos,
                authorship_ratio: analysis.authorship_ratio,
                originality_score: analysis.originality_score,
                total_commits: totalCommits,
                analyzed_at: analysis.analyzed_at,
                languages,
                repos: repos.map(r => ({
                    name: r.repo_name,
                    is_forked: r.is_forked,
                    language: r.language,
                    commits: r.commit_count
                })),
                trust_score: latestScore ? {
                    score: Math.round(latestScore.github_score),
                    originality: latestScore.originality_score,
                    alignment: latestScore.alignment_score,
                    completeness: latestScore.completeness_score,
                    calculated_at: latestScore.calculated_at
                } : null,
                score_history: trustScores.map(s => ({
                    score: Math.round(s.github_score),
                    date: s.calculated_at
                }))
            }
        });
    } catch (error) {
        console.error("Candidate Profile Error:", error);
        res.status(500).json({ error: "Failed to load candidate profile." });
    }
};

module.exports = { getRecruiterDashboard, getCandidateProfile };
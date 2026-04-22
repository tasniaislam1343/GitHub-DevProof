const { GitHubAnalysis, TrustScore } = require('../models');

const calculateTrustScore = async (req, res) => {
    const { username } = req.params;

    try {
        // 1. Fetch the raw data we saved from the previous step
        const analysis = await GitHubAnalysis.findOne({ 
            where: { github_username: username } 
        });

        if (!analysis) {
            return res.status(404).json({ error: "No data found. Run GitHub analysis first." });
        }

        // ==========================================
        // 2. THE TRUSTSCORE ALGORITHM (Teammate's Playground)
        // ==========================================
        
        // Weights: How much does each category matter?
        const WEIGHT_AUTHORSHIP = 0.70; // Originality is worth 70% of the final grade
        const WEIGHT_VOLUME = 0.30;     // Having a good amount of work is worth 30%
        
        // Rules
        const MAX_REPOS_NEEDED = 15; // 15 repos gets you a perfect Volume Score

        // Math
        const volumeScore = Math.min((analysis.total_repos / MAX_REPOS_NEEDED) * 100, 100);
        const authorshipScore = analysis.authorship_ratio; // Already a percentage

        // Final Calculation
        const finalGitHubScore = (authorshipScore * WEIGHT_AUTHORSHIP) + (volumeScore * WEIGHT_VOLUME);

        // ==========================================

        // 3. Save the calculated score to the Cloud Database
        const [trustScore, created] = await TrustScore.findOrCreate({
            where: { candidate_id: analysis.candidate_id },
            defaults: {
                github_score: finalGitHubScore,
                originality_score: authorshipScore,
                completeness_score: volumeScore
            }
        });

        // If a score already existed for them, update it
        if (!created) {
            trustScore.github_score = finalGitHubScore;
            trustScore.originality_score = authorshipScore;
            trustScore.completeness_score = volumeScore;
            await trustScore.save();
        }

        // 4. Send the report card back to the browser
        res.status(200).json({
            message: "TrustScore calculated and saved successfully!",
            candidate: username,
            report_card: {
                authorship_grade: `${authorshipScore.toFixed(1)} / 100`,
                volume_grade: `${volumeScore.toFixed(1)} / 100`,
                FINAL_TRUST_SCORE: `${finalGitHubScore.toFixed(1)} / 100`
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to calculate TrustScore." });
    }
};

module.exports = {
    calculateTrustScore
};
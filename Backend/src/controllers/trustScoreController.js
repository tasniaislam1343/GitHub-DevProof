const { User, Candidate, GitHubAnalysis, Repository, TrustScore } = require('../models');

const generateTrustScore = async (req, res) => {
    const { username } = req.params;

    try {
        // 1. Fetch the saved Feature 2 Data directly using the github_username
        const analysis = await GitHubAnalysis.findOne({ 
            where: { github_username: username },
            order: [['analyzed_at', 'DESC']]
        });
        
        if (!analysis) {
            return res.status(404).json({ error: "GitHub Analysis not found. Run Feature 2 analysis first." });
        }

        // We get the candidate ID straight from the analysis!
        const candidateId = analysis.candidate_id;
        const repositories = await Repository.findAll({ where: { analysis_id: analysis.analysis_id } });

        // 2. THE TRUST SCORE ALGORITHM
        let totalScore = 100;
        
        // Metric A: Authorship Ratio (Are they just forking other people's work?)
        const authorshipRatio = analysis.authorship_ratio; 
        let authorshipGrade = "Pass";
        if (authorshipRatio < 70) {
            totalScore -= (70 - authorshipRatio); // Deduct points if mostly forks
            authorshipGrade = "Warning: High volume of forked repositories.";
        }

        // Metric B: Real Commit Volume
        let totalCommits = 0;
        repositories.forEach(repo => {
            totalCommits += repo.commit_count;
        });

        let commitGrade = "Pass";
        if (totalCommits < 10) {
            totalScore -= 20; // Massive penalty for having repos but almost zero commits
            commitGrade = "Suspicious: Almost zero commit history on claimed projects.";
        }

        // Metric C: Code Similarity (Originality)
        // If code similarity is high, originality score is low.
        // We drop the trust score drastically.
        const originalityScore = analysis.originality_score ?? 100;
        let originalityGrade = "Pass";
        if (originalityScore < 60) {
            // Very harsh penalty for high similarity (low originality)
            const penalty = (100 - originalityScore); // up to 100 points
            totalScore -= penalty;
            originalityGrade = `Critical: High code similarity detected across repositories (${100 - originalityScore}% match).`;
        } else if (originalityScore < 80) {
            totalScore -= 15;
            originalityGrade = "Warning: Moderate code similarity detected.";
        }

        // Clamp the final score between 0 and 100
        const finalTrustScore = Math.max(0, Math.min(100, Math.round(totalScore)));
        const status = finalTrustScore >= 80 ? 'Verified' : 'Flagged';

        // 3. Save the Score to the Database using REAL model columns
        if (TrustScore) {
            await TrustScore.create({
                candidate_id: candidateId,
                github_score: finalTrustScore,
                originality_score: originalityScore,
                alignment_score: authorshipRatio,
                completeness_score: totalCommits > 50 ? 100 : (totalCommits / 50) * 100,
                calculated_at: new Date()
            });
        }

        // 4. Send the Report Card back to the UI
        res.status(200).json({
            message: "TrustScore calculated and saved successfully!",
            candidate: username,
            report_card: {
                authorship_grade: `${authorshipRatio.toFixed(1)} / 100`,
                volume_grade: `${totalCommits} total commits across projects`,
                originality_grade: originalityGrade,
                FINAL_TRUST_SCORE: `${finalTrustScore} / 100`,
                status: finalTrustScore >= 80 ? '✅ DevProof Verified' : '⚠️ High Risk Candidate'
            }
        });

    } catch (error) {
        console.error("TrustScore Error:", error);
        res.status(500).json({ error: error.message || "Failed to calculate Trust Score." });
    }
};

module.exports = {
    generateTrustScore
};
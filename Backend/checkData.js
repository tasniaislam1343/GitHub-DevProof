const { sequelize, GitHubAnalysis } = require('./src/models');

async function checkData() {
    try {
        await sequelize.authenticate();
        const analysis = await GitHubAnalysis.findOne({ where: { github_username: 'octocat' }, order: [['analyzed_at', 'DESC']] });
        console.log(analysis ? analysis.toJSON() : 'No analysis found');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

checkData();

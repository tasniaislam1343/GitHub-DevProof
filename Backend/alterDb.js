const { sequelize } = require('./src/models');

async function alterTable() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');
        await sequelize.query('ALTER TABLE GitHubAnalyses ADD COLUMN originality_score FLOAT DEFAULT 100;');
        console.log('Column added successfully');
    } catch (e) {
        // Ignore if column already exists
        if (e.message.includes('Duplicate column name')) {
            console.log('Column already exists');
        } else {
            console.error('Error:', e.message);
        }
    } finally {
        process.exit();
    }
}

alterTable();

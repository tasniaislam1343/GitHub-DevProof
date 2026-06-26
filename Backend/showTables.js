const { sequelize } = require('./src/models');

async function getTables() {
    try {
        await sequelize.authenticate();
        const [results] = await sequelize.query('SHOW TABLES;');
        console.log('Tables:', results);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit();
    }
}

getTables();

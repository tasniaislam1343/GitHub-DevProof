const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_DATABASE, // Updated to match your new .env
    process.env.DB_USERNAME, // Updated to match your new .env
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT, // Added the custom cloud port
        dialect: 'mysql',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true, // Cloud databases require secure SSL connections
                rejectUnauthorized: false
            }
        }
    }
);

module.exports = sequelize;
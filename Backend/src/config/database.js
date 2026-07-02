const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// Vercel nft can't trace Sequelize's dynamic dialect require.
// These explicit requires force nft to bundle mysql2 + the full MySQL dialect.
require('mysql2');
require('sequelize/lib/dialects/mysql/index');
require('sequelize/lib/dialects/mysql/connection-manager');

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
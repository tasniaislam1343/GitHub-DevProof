const path = require('path');

if (process.env.VERCEL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
}

const app = require('../Backend/src/server');

module.exports = app;

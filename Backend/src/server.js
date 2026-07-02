const path = require('path');
if (!process.env.VERCEL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const githubRoutes = require('./routes/githubRoutes');
const trustScoreRoutes = require('./routes/trustScoreRoutes');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/', (req, res) => {
    res.send('DevProof API is running!');
});
app.use('/api/github', githubRoutes);
app.use('/api/trustscore', trustScoreRoutes);

const PORT = process.env.PORT || 5001;

if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      connectWithRetry();
  });
}

module.exports = app;

// Retry DB connection with exponential backoff
async function connectWithRetry(retries = 5, delay = 3000) {
    for (let i = 1; i <= retries; i++) {
        try {
            await sequelize.authenticate();
            console.log('✅ Database connected!');

            // Ensure new columns exist (safe for TiDB — ignores if they already exist)
            const qi = sequelize.getQueryInterface();
            try {
                await qi.addColumn('Users', 'password', { type: require('sequelize').DataTypes.STRING });
                console.log('  → Added password column');
            } catch (e) { /* column already exists */ }
            try {
                await qi.addColumn('Users', 'github_username', { type: require('sequelize').DataTypes.STRING });
                console.log('  → Added github_username column');
            } catch (e) { /* column already exists */ }
            return; // success
        } catch (err) {
            console.error(`⚠️  DB connection attempt ${i}/${retries} failed: ${err.message}`);
            if (i < retries) {
                console.log(`   Retrying in ${delay / 1000}s...`);
                await new Promise(r => setTimeout(r, delay));
                delay = Math.min(delay * 2, 30000); // exponential backoff, max 30s
            } else {
                console.error('❌ All DB connection attempts failed. Server is running but DB features are unavailable.');
            }
        }
    }
}
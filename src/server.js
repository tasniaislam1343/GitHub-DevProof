const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const githubRoutes = require('./routes/githubRoutes'); // <-- Imported Route
const trustScoreRoutes = require('./routes/trustScoreRoutes'); // NEW: Import TrustScore routes

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('DevProof API is running!');
});
app.use('/api/github', githubRoutes); // <-- Tell Express to use it
app.use('/api/trustscore', trustScoreRoutes); // NEW: Tell Express to use it

const PORT = process.env.PORT || 5001;

// Sync database and start server
// The Production Way
// TEMPORARY UNLOCK: Drop and rebuild
// PERMANENT LOCKDOWN
sequelize.authenticate() 
    .then(() => {
        console.log('✅ Database connected securely!');
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => console.error('❌ Database connection failed:', err));
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('DevProof API is running!');
});

const PORT = process.env.PORT || 5000;

// Sync database and start server
sequelize.sync({ alter: true }) // 'alter: true' creates/updates tables without deleting data
    .then(() => {
        console.log('✅ Database synced successfully!');
        app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => console.error('❌ Database connection failed:', err));
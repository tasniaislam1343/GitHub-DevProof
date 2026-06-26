const express = require('express');
const { generateTrustScore } = require('../controllers/trustScoreController');

const router = express.Router();

// Define the route: GET /api/trustscore/:username
router.get('/:username', generateTrustScore);

module.exports = router;
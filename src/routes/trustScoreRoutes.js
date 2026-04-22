const express = require('express');
const { calculateTrustScore } = require('../controllers/trustScoreController');

const router = express.Router();

// Define the route: GET /api/trustscore/:username
router.get('/:username', calculateTrustScore);

module.exports = router;
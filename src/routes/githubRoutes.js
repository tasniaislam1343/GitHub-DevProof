const express = require('express');
const { analyzeCandidate } = require('../controllers/githubController');

const router = express.Router();

// Define the route: GET /api/github/:username
router.get('/:username', analyzeCandidate);

module.exports = router;
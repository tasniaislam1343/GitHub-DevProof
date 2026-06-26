const express = require('express');
const { getRecruiterDashboard, getCandidateProfile } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/recruiter', getRecruiterDashboard);
router.get('/candidate/:username', getCandidateProfile);

module.exports = router;
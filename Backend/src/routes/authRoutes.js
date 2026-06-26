const express = require('express');
const { register, login, githubLogin, googleLogin } = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/github', githubLogin);
router.post('/google', googleLogin);

module.exports = router;
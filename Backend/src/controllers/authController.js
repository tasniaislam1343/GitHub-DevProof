const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { User, Candidate, Recruiter } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'devproof_super_secret_key';

const register = async (req, res) => {
    const { email, password, github_username, role } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'Email already in use' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const userRole = role || 'candidate'; // Default to candidate

        const newUser = await User.create({
            email,
            password: hashedPassword,
            github_username: github_username || null,
            user_type: userRole
        });

        // Create the associated profile table
        if (userRole === 'candidate') {
            await Candidate.create({ user_id: newUser.user_id });
        } else if (userRole === 'recruiter') {
            await Recruiter.create({ user_id: newUser.user_id });
        }

        // Return JWT token immediately after registration
        const token = jwt.sign({ id: newUser.user_id, role: userRole }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            message: 'Registration successful!',
            token,
            user: { id: newUser.user_id, email: newUser.email, role: userRole, github: github_username || null }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during registration.' });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });

        // Update legacy user missing a valid role
        if (!user.user_type || !['candidate', 'recruiter'].includes(user.user_type)) {
            user.user_type = 'candidate';
            await user.save();
            const existingCandidate = await Candidate.findOne({ where: { user_id: user.user_id } });
            if (!existingCandidate) {
                await Candidate.create({ user_id: user.user_id });
            }
        }

        const token = jwt.sign({ id: user.user_id, role: user.user_type }, JWT_SECRET, { expiresIn: '24h' });

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user.user_id, email: user.email, role: user.user_type, github: user.github_username }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error during login.' });
    }
};

/**
 * GitHub OAuth Login
 * Frontend sends the OAuth `code` from GitHub redirect.
 * We exchange it for an access token, fetch user profile, and create/find the user.
 */
const githubLogin = async (req, res) => {
    const { code, role } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'GitHub OAuth code is required' });
    }

    try {
        // 1. Exchange code for access token
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: 'http://localhost:5173/login'
            },
            { headers: { Accept: 'application/json' } }
        );

        const accessToken = tokenResponse.data.access_token;
        console.log("GitHub Token Exchange Response:", tokenResponse.data);
        if (!accessToken) {
            return res.status(401).json({ error: 'Failed to authenticate with GitHub.' });
        }

        // 2. Fetch GitHub user profile
        const profileResponse = await axios.get('https://api.github.com/user', {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'User-Agent': 'DevProof-App'
            }
        });

        const profile = profileResponse.data;
        const githubEmail = profile.email || `${profile.login}@github.com`;

        // 3. Find or create user
        let user = await User.findOne({ where: { email: githubEmail } });
        const userRole = role || 'candidate';

        if (!user) {
            user = await User.create({
                email: githubEmail,
                name: profile.name || profile.login,
                github_username: profile.login,
                user_type: userRole,
                password: await bcrypt.hash(accessToken.substring(0, 20), 10) // placeholder password
            });

            if (userRole === 'candidate') {
                await Candidate.create({ user_id: user.user_id });
            } else if (userRole === 'recruiter') {
                await Recruiter.create({ user_id: user.user_id });
            }
        } else {
            // Legacy user missing a valid role: default to candidate
            if (!user.user_type || !['candidate', 'recruiter'].includes(user.user_type)) {
                user.user_type = 'candidate';
                await user.save();
                // Ensure profile exists
                const existingCandidate = await Candidate.findOne({ where: { user_id: user.user_id } });
                if (!existingCandidate) {
                    await Candidate.create({ user_id: user.user_id });
                }
            }
        }

        // 4. Generate JWT
        const token = jwt.sign({ id: user.user_id, role: user.user_type }, JWT_SECRET, { expiresIn: '24h' });

        res.status(200).json({
            message: 'GitHub login successful',
            token,
            user: {
                id: user.user_id,
                email: user.email,
                role: user.user_type,
                github: user.github_username || profile.login
            }
        });
    } catch (error) {
        if (error.response) {
            console.error('GitHub OAuth Error Data:', error.response.data);
        } else {
            console.error('GitHub OAuth Error:', error.message);
        }
        res.status(500).json({ error: 'Failed to authenticate with GitHub.' });
    }
};

/**
 * Google OAuth Login
 * Frontend sends the Google ID token.
 * We verify it, extract profile, and create/find the user.
 */
const googleLogin = async (req, res) => {
    const { credential, role } = req.body;

    if (!credential) {
        return res.status(400).json({ error: 'Google credential is required' });
    }

    try {
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name;

        // Find or create user
        let user = await User.findOne({ where: { email } });
        const userRole = role || 'candidate';

        if (!user) {
            user = await User.create({
                email,
                name,
                user_type: userRole,
                password: await bcrypt.hash(email + Date.now(), 10) // placeholder
            });

            if (userRole === 'candidate') {
                await Candidate.create({ user_id: user.user_id });
            } else if (userRole === 'recruiter') {
                await Recruiter.create({ user_id: user.user_id });
            }
        } else {
            // Legacy user missing a valid role: default to candidate
            if (!user.user_type || !['candidate', 'recruiter'].includes(user.user_type)) {
                user.user_type = 'candidate';
                await user.save();
                // Ensure profile exists
                const existingCandidate = await Candidate.findOne({ where: { user_id: user.user_id } });
                if (!existingCandidate) {
                    await Candidate.create({ user_id: user.user_id });
                }
            }
        }

        const token = jwt.sign({ id: user.user_id, role: user.user_type }, JWT_SECRET, { expiresIn: '24h' });

        res.status(200).json({
            message: 'Google login successful',
            token,
            user: { id: user.user_id, email: user.email, role: user.user_type, github: user.github_username }
        });
    } catch (error) {
        console.error('Google OAuth Error:', error.message);
        res.status(500).json({ error: 'Failed to authenticate with Google.' });
    }
};

module.exports = { register, login, githubLogin, googleLogin };
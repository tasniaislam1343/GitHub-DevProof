const axios = require('axios');
const { spawn } = require('child_process');

/**
 * Fetch GitHub user profile
 */
const fetchGitHubProfile = async (username) => {
    try {
        const response = await axios.get(`https://api.github.com/users/${username}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching GitHub profile:', error.message);
        return null;
    }
};

/**
 * Fetch repositories of a user
 */
const fetchUserRepos = async (username) => {
    try {
        const response = await axios.get(`https://api.github.com/users/${username}/repos`);
        return response.data;
    } catch (error) {
        console.error('Error fetching repos:', error.message);
        return [];
    }
};

/**
 * Fetch commits of a repository
 */
const fetchRepoCommits = async (username, repoName) => {
    try {
        const response = await axios.get(`https://api.github.com/repos/${username}/${repoName}/commits?per_page=30`);
        
        // Ensure we are returning the length (a number), not the whole array/object
        return Array.isArray(response.data) ? response.data.length : 0; 
    } catch (error) {
        // If repo is empty or private, return 0
        return 0;
    }
};

/**
 * 🚀 Node.js ↔ Python Bridge for AST Detection
 */
const runASTDetector = (candidateCode, sourceCode) => {
    return new Promise((resolve) => {
        const pythonProcess = spawn('python3', ['src/services/ast_detector.py']);

        let result = '';
        let errorOutput = '';

        // Capture output from Python
        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        // Capture errors (VERY useful for debugging)
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        // When Python process finishes
        pythonProcess.on('close', (code) => {
            if (errorOutput) {
                console.error('Python Error:', errorOutput);
            }

            const score = parseFloat(result);
            resolve(isNaN(score) ? 0 : score);
        });

        // Send input data to Python
        const payload = {
            code_a: candidateCode,
            code_b: sourceCode
        };

        pythonProcess.stdin.write(JSON.stringify(payload));
        pythonProcess.stdin.end();
    });
};

module.exports = {
    fetchGitHubProfile,
    fetchUserRepos,
    fetchRepoCommits,
    runASTDetector
};
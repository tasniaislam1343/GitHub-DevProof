const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const getHeaders = () => {
    const headers = {};
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
};

const fetchGitHubProfile = async (username) => {
    try {
        const response = await axios.get(`https://api.github.com/users/${username}`, { headers: getHeaders() });
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 403) {
            throw new Error('GitHub API rate limit exceeded. Please provide a GITHUB_TOKEN in .env or try again later.');
        }
        throw new Error('Could not fetch GitHub profile: ' + error.message);
    }
};

const fetchUserRepos = async (username) => {
    try {
        const response = await axios.get(`https://api.github.com/users/${username}/repos?per_page=100`, { headers: getHeaders() });
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 403) {
            throw new Error('GitHub API rate limit exceeded. Please provide a GITHUB_TOKEN in .env or try again later.');
        }
        throw new Error('Could not fetch GitHub repositories: ' + error.message);
    }
};

const fetchRepoCommits = async (username, repoName) => {
    try {
        const response = await axios.get(`https://api.github.com/repos/${username}/${repoName}/commits?per_page=30`, { headers: getHeaders() });
        // We MUST return the length (a number), not the whole response object!
        return Array.isArray(response.data) ? response.data.length : 0;
    } catch (error) {
        if (error.response && error.response.status === 403) {
            throw new Error('GitHub API rate limit exceeded.');
        }
        return 0; // Return 0 if the repo is empty or private
    }
};

// Source code file extensions we want to analyze
const CODE_EXTENSIONS = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
    '.go', '.rs', '.rb', '.php', '.cs', '.swift', '.kt', '.scala',
    '.vue', '.svelte'
];

/**
 * Fetch a real source code file from a GitHub repo.
 * Searches root, then common subdirectories, then falls back to README.
 */
const fetchRepoFileContent = async (username, repoName) => {
    try {
        // Get repo root contents
        const headers = getHeaders();
        headers['Accept'] = 'application/vnd.github.v3+json';
        const rootResponse = await axios.get(
            `https://api.github.com/repos/${username}/${repoName}/contents`,
            { headers }
        );

        const contents = rootResponse.data;
        if (!Array.isArray(contents)) return '';

        // Find a code file in root
        let codeFile = contents.find(f =>
            f.type === 'file' && CODE_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
        );

        // If no code file in root, search in common subdirectories
        if (!codeFile) {
            const subDirs = contents.filter(f => f.type === 'dir');
            const priorityDirs = ['src', 'lib', 'app', 'pages', 'components', 'scripts', 'utils'];
            
            // Sort: priority dirs first, then others
            subDirs.sort((a, b) => {
                const aIdx = priorityDirs.indexOf(a.name.toLowerCase());
                const bIdx = priorityDirs.indexOf(b.name.toLowerCase());
                if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
                if (aIdx >= 0) return -1;
                if (bIdx >= 0) return 1;
                return 0;
            });

            for (const dir of subDirs.slice(0, 4)) {
                try {
                    const dirResponse = await axios.get(dir.url, { headers: getHeaders() });
                    const dirContents = dirResponse.data;
                    if (Array.isArray(dirContents)) {
                        codeFile = dirContents.find(f =>
                            f.type === 'file' && CODE_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
                        );
                        if (codeFile) break;
                    }
                } catch (e) { /* ignore */ }
            }
        }

        // Fallback: use README.md for content comparison (detects copied project descriptions)
        if (!codeFile) {
            codeFile = contents.find(f =>
                f.type === 'file' && f.name.toLowerCase().includes('readme')
            );
        }

        if (!codeFile || !codeFile.download_url) return '';

        // Fetch the raw content
        const fileResponse = await axios.get(codeFile.download_url, { headers: getHeaders() });
        const content = typeof fileResponse.data === 'string' ? fileResponse.data : JSON.stringify(fileResponse.data);

        // Return first 5000 chars to avoid huge payloads
        return content.substring(0, 5000);
    } catch (error) {
        return '';
    }
};

/**
 * Run the AST detector with multiple code samples for cross-repo comparison.
 * Returns { max_similarity, avg_similarity, pair_results }
 */
const runASTDetectorMulti = (codeSamples) => {
    return new Promise((resolve) => {
        const pythonProcess = spawn('python3', [path.join(__dirname, 'ast_detector.py')]);
        let result = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => { result += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });

        pythonProcess.on('close', () => {
            try {
                const parsed = JSON.parse(result);
                resolve(parsed);
            } catch (e) {
                resolve({ max_similarity: 0, avg_similarity: 0, pair_results: [] });
            }
        });

        pythonProcess.stdin.write(JSON.stringify({ code_samples: codeSamples }));
        pythonProcess.stdin.end();
    });
};

// Keep the legacy pairwise function for backward compatibility
const runASTDetector = (candidateCode, sourceCode) => {
    return new Promise((resolve) => {
        const pythonProcess = spawn('python3', [path.join(__dirname, 'ast_detector.py')]);
        let result = '';
        pythonProcess.stdout.on('data', (data) => { result += data.toString(); });
        pythonProcess.on('close', () => { resolve(parseFloat(result) || 0); });
        pythonProcess.stdin.write(JSON.stringify({ code_a: candidateCode, code_b: sourceCode }));
        pythonProcess.stdin.end();
    });
};

module.exports = {
    fetchGitHubProfile,
    fetchUserRepos,
    fetchRepoCommits,
    fetchRepoFileContent,
    runASTDetector,
    runASTDetectorMulti
};
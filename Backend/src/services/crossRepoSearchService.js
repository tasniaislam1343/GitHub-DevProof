/**
 * Cross-Repository Search Service
 * ================================
 * Uses GitHub's Code Search API to find potentially plagiarized code
 * across ALL public repositories on GitHub.
 *
 * Strategy:
 *   1. Extract unique "signatures" from the user's code (function names,
 *      class names, distinctive patterns, import combos).
 *   2. Search GitHub for those signatures across public repos.
 *   3. Fetch source code from matching external repos.
 *   4. Return code samples ready for comparison by ast_detector.py.
 */

const axios = require('axios');

const getHeaders = () => {
    const headers = {
        'Accept': 'application/vnd.github.v3+json'
    };
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
};

// Source code extensions we care about
const CODE_EXTENSIONS = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
    '.go', '.rs', '.rb', '.php', '.cs', '.swift', '.kt', '.scala',
    '.vue', '.svelte'
];

/**
 * Extract unique code signatures from a code string.
 * These are distinctive patterns we can search for on GitHub.
 */
const extractSignatures = (code, language) => {
    const signatures = [];
    if (!code || code.trim().length < 30) return signatures;

    // 1. Function/method declarations
    //    JS/TS: function foo(...), const foo = (...) =>
    //    Python: def foo(...)
    //    Java/C: void foo(...), int foo(...)
    const funcPatterns = [
        /(?:function|const|let|var)\s+([a-zA-Z_]\w{3,})\s*(?:=\s*(?:async\s*)?\(|[=(])/g,
        /def\s+([a-zA-Z_]\w{3,})\s*\(/g,
        /(?:public|private|protected|static)?\s*(?:void|int|String|boolean|float|double)\s+([a-zA-Z_]\w{3,})\s*\(/g,
        /func\s+([a-zA-Z_]\w{3,})\s*\(/g,  // Go
        /fn\s+([a-zA-Z_]\w{3,})\s*\(/g,     // Rust
    ];

    for (const pattern of funcPatterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
            const name = match[1];
            // Skip very common names
            const commonNames = new Set([
                'main', 'init', 'get', 'set', 'run', 'start', 'stop',
                'test', 'setup', 'render', 'constructor', 'toString',
                'handle', 'create', 'update', 'delete', 'fetch', 'log',
                'map', 'filter', 'reduce', 'forEach', 'find', 'sort'
            ]);
            if (!commonNames.has(name) && name.length >= 4) {
                signatures.push(name);
            }
        }
    }

    // 2. Class declarations
    const classPattern = /class\s+([A-Z][a-zA-Z_]\w{3,})/g;
    let match;
    while ((match = classPattern.exec(code)) !== null) {
        const name = match[1];
        const commonClasses = new Set([
            'App', 'Main', 'User', 'Item', 'List', 'Node', 'Error',
            'Component', 'Controller', 'Service', 'Model', 'View'
        ]);
        if (!commonClasses.has(name) && name.length >= 4) {
            signatures.push(name);
        }
    }

    // 3. Distinctive multi-word identifiers (camelCase or snake_case with 2+ words)
    const multiWordPattern = /([a-z][a-zA-Z]{8,}|[a-z]+_[a-z]+_[a-z]+)/g;
    while ((match = multiWordPattern.exec(code)) !== null) {
        const name = match[1];
        if (name.length >= 10 && !signatures.includes(name)) {
            signatures.push(name);
        }
    }

    // 4. Unique import combinations (distinctive library usage patterns)
    const importPatterns = [
        /import\s+.*?from\s+['"]([^'"./][^'"]*)['"]/g,
        /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g,
    ];
    const imports = [];
    for (const pattern of importPatterns) {
        while ((match = pattern.exec(code)) !== null) {
            const pkg = match[1];
            // Skip very common packages
            const commonPkgs = new Set([
                'react', 'express', 'path', 'fs', 'os', 'http', 'https',
                'util', 'crypto', 'stream', 'events', 'url', 'querystring',
                'lodash', 'axios', 'moment', 'dotenv', 'cors', 'body-parser',
                'next', 'vue', 'angular', 'svelte'
            ]);
            if (!commonPkgs.has(pkg) && pkg.length >= 3) {
                imports.push(pkg);
            }
        }
    }
    // If there are ≥2 uncommon imports, the combination is a signature
    if (imports.length >= 2) {
        signatures.push(imports.slice(0, 3).join(' '));
    }

    // 5. Extract distinctive code blocks (unique 1-line expressions)
    const lines = code.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 30 && l.length < 120)
        .filter(l => !l.startsWith('//') && !l.startsWith('#') && !l.startsWith('*'))
        .filter(l => !l.startsWith('import') && !l.startsWith('require'));

    if (lines.length > 0) {
        // Pick 1-2 distinctive lines
        const sortedByLength = [...lines].sort((a, b) => b.length - a.length);
        for (const line of sortedByLength.slice(0, 2)) {
            // Extract the most distinctive portion (skip boilerplate keywords)
            const cleaned = line
                .replace(/\b(const|let|var|function|return|if|else|for|while|class|public|private|static|void|int|String)\b/g, '')
                .replace(/[{}()\[\];,=<>!+\-*/&|^~?:]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (cleaned.length > 15) {
                signatures.push(cleaned.substring(0, 60));
            }
        }
    }

    // Deduplicate and limit
    const unique = [...new Set(signatures)];
    return unique.slice(0, 5);
};

/**
 * Map programming language names to GitHub search language qualifiers.
 */
const getLanguageQualifier = (language) => {
    if (!language || language === 'Unknown') return '';
    const map = {
        'JavaScript': 'javascript',
        'TypeScript': 'typescript',
        'Python': 'python',
        'Java': 'java',
        'C': 'c',
        'C++': 'cpp',
        'C#': 'csharp',
        'Go': 'go',
        'Rust': 'rust',
        'Ruby': 'ruby',
        'PHP': 'php',
        'Swift': 'swift',
        'Kotlin': 'kotlin',
        'Scala': 'scala',
        'HTML': 'html',
        'CSS': 'css'
    };
    return map[language] || language.toLowerCase();
};

/**
 * Search GitHub Code Search API for a specific query.
 * Returns up to 5 matching repos (excluding the candidate's own repos).
 */
const searchGitHubCode = async (query, language, excludeUser) => {
    try {
        let searchQuery = `${query} in:file`;
        const langQualifier = getLanguageQualifier(language);
        if (langQualifier) {
            searchQuery += ` language:${langQualifier}`;
        }
        // Exclude the candidate's own repos
        searchQuery += ` -user:${excludeUser}`;

        const response = await axios.get(
            `https://api.github.com/search/code?q=${encodeURIComponent(searchQuery)}&per_page=5`,
            {
                headers: getHeaders(),
                timeout: 10000
            }
        );

        if (!response.data || !response.data.items) return [];

        // Extract unique repos from search results
        const repoMap = new Map();
        for (const item of response.data.items) {
            const repoFullName = item.repository.full_name;
            if (!repoMap.has(repoFullName)) {
                repoMap.set(repoFullName, {
                    full_name: repoFullName,
                    owner: item.repository.owner.login,
                    repo: item.repository.name,
                    url: item.repository.html_url,
                    file_path: item.path,
                    file_url: item.html_url
                });
            }
        }

        return Array.from(repoMap.values()).slice(0, 5);
    } catch (error) {
        // GitHub Code Search rate limit is 10 req/min for authenticated users
        if (error.response && error.response.status === 403) {
            console.warn('GitHub Code Search rate limit hit, skipping...');
        }
        return [];
    }
};

/**
 * Fetch source code content from a specific file in an external repo.
 */
const fetchExternalFileContent = async (owner, repo, filePath) => {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
            { headers: getHeaders(), timeout: 10000 }
        );

        if (!response.data || !response.data.download_url) return '';

        const fileResponse = await axios.get(response.data.download_url, {
            headers: getHeaders(),
            timeout: 10000
        });

        const content = typeof fileResponse.data === 'string'
            ? fileResponse.data
            : JSON.stringify(fileResponse.data);

        return content.substring(0, 5000);
    } catch (error) {
        return '';
    }
};

/**
 * Fetch code from the root or common subdirectories of an external repo.
 * This is a lighter version of fetchRepoFileContent for external repos.
 */
const fetchExternalRepoCode = async (owner, repo) => {
    try {
        const response = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/contents`,
            { headers: getHeaders(), timeout: 10000 }
        );

        if (!Array.isArray(response.data)) return '';

        // Find a code file in root
        let codeFile = response.data.find(f =>
            f.type === 'file' && CODE_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
        );

        // Search subdirectories
        if (!codeFile) {
            const subDirs = response.data
                .filter(f => f.type === 'dir')
                .filter(f => ['src', 'lib', 'app', 'pages', 'scripts', 'utils'].includes(f.name.toLowerCase()));

            for (const dir of subDirs.slice(0, 2)) {
                try {
                    const dirResp = await axios.get(dir.url, {
                        headers: getHeaders(), timeout: 10000
                    });
                    if (Array.isArray(dirResp.data)) {
                        codeFile = dirResp.data.find(f =>
                            f.type === 'file' && CODE_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
                        );
                        if (codeFile) break;
                    }
                } catch (e) { /* skip */ }
            }
        }

        if (!codeFile || !codeFile.download_url) return '';

        const fileResp = await axios.get(codeFile.download_url, {
            headers: getHeaders(), timeout: 10000
        });
        const content = typeof fileResp.data === 'string'
            ? fileResp.data
            : JSON.stringify(fileResp.data);

        return content.substring(0, 5000);
    } catch (error) {
        return '';
    }
};

/**
 * Main entry point: Search for similar code across GitHub.
 *
 * @param {string} username - The GitHub username to exclude from results
 * @param {Array} userCodeSamples - Array of { repo, code, language } from user's repos
 * @returns {Array} External code samples ready for comparison:
 *   [{ repo, owner, url, code }]
 */
const findSimilarExternalRepos = async (username, userCodeSamples) => {
    if (!userCodeSamples || userCodeSamples.length === 0) {
        return [];
    }

    const allExternalMatches = new Map(); // Deduplicate by repo full_name

    // Process each user repo — extract signatures and search
    for (const sample of userCodeSamples.slice(0, 4)) {
        const signatures = extractSignatures(sample.code, sample.language);

        if (signatures.length === 0) continue;

        // Search for each signature (limit to 3 searches per repo to respect rate limits)
        for (const sig of signatures.slice(0, 3)) {
            // Wait 1 second between code search requests (rate limit: 10/min)
            await new Promise(resolve => setTimeout(resolve, 1000));

            const matches = await searchGitHubCode(sig, sample.language, username);

            for (const match of matches) {
                if (!allExternalMatches.has(match.full_name)) {
                    allExternalMatches.set(match.full_name, match);
                }
            }
        }
    }

    // Now fetch actual source code from the top external matches
    const externalRepos = Array.from(allExternalMatches.values()).slice(0, 10);
    const externalCodeSamples = [];

    for (const extRepo of externalRepos) {
        // Try to get the specific file that matched, otherwise get any code file
        let code = '';
        if (extRepo.file_path) {
            code = await fetchExternalFileContent(extRepo.owner, extRepo.repo, extRepo.file_path);
        }
        if (!code || code.trim().length < 20) {
            code = await fetchExternalRepoCode(extRepo.owner, extRepo.repo);
        }

        if (code && code.trim().length > 20) {
            externalCodeSamples.push({
                repo: extRepo.repo,
                owner: extRepo.owner,
                url: extRepo.url,
                code: code
            });
        }
    }

    return externalCodeSamples;
};

module.exports = {
    extractSignatures,
    searchGitHubCode,
    fetchExternalFileContent,
    fetchExternalRepoCode,
    findSimilarExternalRepos
};

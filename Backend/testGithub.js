const { fetchUserRepos, fetchGitHubProfile, fetchRepoFileContent } = require('./src/services/githubService');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

(async () => {
  try {
    console.log("Token starts with:", process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.substring(0,4) : 'none');
    console.log("Fetching profile for torvalds...");
    const profile = await fetchGitHubProfile('torvalds');
    console.log("Profile fetched:", profile.login);
    console.log("Fetching repos for torvalds...");
    const repos = await fetchUserRepos('torvalds');
    console.log("Repos fetched:", repos.length);
    if (repos.length > 0) {
      console.log("Fetching file content for", repos[0].name);
      const content = await fetchRepoFileContent('torvalds', repos[0].name);
      console.log("Content length:", content.length);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
})();

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 1. User (Supertype)
const User = sequelize.define('User', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING, unique: true },
    user_type: { type: DataTypes.STRING } // 'candidate' or 'recruiter'
}, { timestamps: false });

// 2. Company
const Company = sequelize.define('Company', {
    company_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING },
    domain: { type: DataTypes.STRING },
    contact_mail: { type: DataTypes.STRING }
}, { timestamps: false });

// 3. Candidate (Subtype)
const Candidate = sequelize.define('Candidate', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true }
}, { timestamps: false });

// 4. Recruiter (Subtype)
const Recruiter = sequelize.define('Recruiter', {
    user_id: { type: DataTypes.INTEGER, primaryKey: true },
    job_title: { type: DataTypes.STRING }
}, { timestamps: false });

// 5. JobPost
const JobPost = sequelize.define('JobPost', {
    job_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING },
    job_description: { type: DataTypes.TEXT }
}, { timestamps: false });

// 6. TrustScore
const TrustScore = sequelize.define('TrustScore', {
    trust_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    github_score: { type: DataTypes.FLOAT },
    originality_score: { type: DataTypes.FLOAT },
    certificate_score: { type: DataTypes.FLOAT },
    alignment_score: { type: DataTypes.FLOAT },
    completeness_score: { type: DataTypes.FLOAT },
    calculated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

// 7. Certificate
const Certificate = sequelize.define('Certificate', {
    certificate_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    url: { type: DataTypes.STRING },
    credibility_tier: { type: DataTypes.STRING },
    issuer: { type: DataTypes.STRING },
    verification_status: { type: DataTypes.ENUM('verified', 'unverified', 'fake') }
}, { timestamps: false });

// 8. GitHubAnalysis
const GitHubAnalysis = sequelize.define('GitHubAnalysis', {
    analysis_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    github_id: { type: DataTypes.STRING },
    github_username: { type: DataTypes.STRING },
    authorship_ratio: { type: DataTypes.FLOAT },
    total_repos: { type: DataTypes.INTEGER },
    language_growth_score: { type: DataTypes.FLOAT },
    commit_consistency_score: { type: DataTypes.FLOAT },
    analyzed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { timestamps: false });

// 9. Repository
const Repository = sequelize.define('Repository', {
    repo_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    repo_name: { type: DataTypes.STRING },
    is_forked: { type: DataTypes.BOOLEAN },
    is_claimed_original: { type: DataTypes.BOOLEAN },
    language: { type: DataTypes.STRING },
    commit_count: { type: DataTypes.INTEGER }
}, { timestamps: false });

// 10. AuditLog
const AuditLog = sequelize.define('AuditLog', {
    audit_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    action: { type: DataTypes.STRING },
    result_snapshot: { type: DataTypes.JSON }
}, { timestamps: false });

// ==========================================
// RELATIONSHIPS (The Lines in your EER)
// ==========================================

// Subtypes
User.hasOne(Candidate, { foreignKey: 'user_id' });
Candidate.belongsTo(User, { foreignKey: 'user_id' });

User.hasOne(Recruiter, { foreignKey: 'user_id' });
Recruiter.belongsTo(User, { foreignKey: 'user_id' });

// Recruiter & Company
Company.hasMany(Recruiter, { foreignKey: 'company_id' });
Recruiter.belongsTo(Company, { foreignKey: 'company_id' });

// Recruiter & JobPosts
Recruiter.hasMany(JobPost, { foreignKey: 'recruiter_id' });
JobPost.belongsTo(Recruiter, { foreignKey: 'recruiter_id' });

// Candidate & TrustScore
Candidate.hasMany(TrustScore, { foreignKey: 'candidate_id' });
TrustScore.belongsTo(Candidate, { foreignKey: 'candidate_id' });

// Candidate & GitHubAnalysis
Candidate.hasOne(GitHubAnalysis, { foreignKey: 'candidate_id' });
GitHubAnalysis.belongsTo(Candidate, { foreignKey: 'candidate_id' });

// GitHubAnalysis & Repository
GitHubAnalysis.hasMany(Repository, { foreignKey: 'analysis_id' });
Repository.belongsTo(GitHubAnalysis, { foreignKey: 'analysis_id' });

// Many-to-Many: Candidate & Certificate
Candidate.belongsToMany(Certificate, { through: 'Candidate_Certificate', foreignKey: 'candidate_id' });
Certificate.belongsToMany(Candidate, { through: 'Candidate_Certificate', foreignKey: 'certificate_id' });

// User & AuditLog
User.hasMany(AuditLog, { foreignKey: 'user_id' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
    sequelize,
    User, Company, Candidate, Recruiter, JobPost, TrustScore, Certificate, GitHubAnalysis, Repository, AuditLog
};
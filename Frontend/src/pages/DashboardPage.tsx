import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { useNavigate } from 'react-router-dom';

interface CandidateRow {
  id: number; name: string; email: string; github: string;
  total_repos: number; originality: number; authorship_ratio: number;
  trust_score: number | string; status: string;
  analyzed_at: string | null; score_calculated_at: string | null;
}
interface Stats {
  total_candidates: number; avg_trust_score: number;
  verified_count: number; flagged_count: number;
  pending_count: number; review_count: number;
}
interface CandidateProfile {
  username: string; total_repos: number; authorship_ratio: number;
  originality_score: number; total_commits: number; analyzed_at: string;
  languages: { name: string; count: number; percent: number }[];
  repos: { name: string; is_forked: boolean; language: string; commits: number }[];
  trust_score: { score: number; originality: number; alignment: number; completeness: number } | null;
  score_history: { score: number; date: string }[];
}

// Animated SVG ring
function ScoreRing({ score, size = 180 }: { score: number; size?: number }) {
  const r = (size - 16) / 2, c = 2 * Math.PI * r;
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${(score / 100) * c} ${c}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="38" fontWeight="800"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>{score}</text>
    </svg>
  );
}

function MetricBar({ label, value, max = 100, icon }: { label: string; value: number; max?: number; icon: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 75 ? 'var(--accent-green)' : pct >= 40 ? 'var(--accent-orange)' : 'var(--accent-red)';
  return (
    <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,.03)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{icon} {label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{Math.round(value)}{max === 100 ? '%' : ''}</span>
      </div>
      <div className="dp-progress"><div className="dp-progress-fill" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="glass-card animate-slideUp" style={{ padding: '20px 24px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
    </div>
  );
}

// ── Candidate Dashboard ──
function CandidateDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ghUsername, setGhUsername] = useState(user?.github || '');
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (name: string) => {
    if (!name.trim()) return;
    setLoading(true); setError('');
    try {
      const data = await api.dashboard.getCandidateProfile(name.trim());
      setProfile(data.profile);
    } catch {
      // Fallback: try trustscore endpoint
      try {
        const ts = await api.trustscore.generate(name.trim());
        const rc = ts.report_card;
        setProfile({
          username: name.trim(), total_repos: 0, authorship_ratio: parseFloat(rc.authorship_grade) || 0,
          originality_score: 0, total_commits: 0, analyzed_at: '', languages: [], repos: [],
          trust_score: { score: parseInt(rc.FINAL_TRUST_SCORE), originality: 0, alignment: 0, completeness: 0 },
          score_history: []
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Run GitHub Analysis first, then generate TrustScore.');
      }
    } finally { setLoading(false); }
  };

  const score = profile?.trust_score?.score ?? 0;
  const status = score >= 80 ? '✅ DevProof Verified' : score >= 50 ? '⚠️ Needs Review' : '🚨 High Risk';
  const langColors: Record<string, string> = {
    JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
    'C++': '#f34b7d', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516', PHP: '#4F5D95',
    CSS: '#563d7c', HTML: '#e34c26', Unknown: '#666'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Search */}
      <div className="glass-card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>🔍 Your Developer Profile</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Enter your GitHub username to view your full trust analysis.</p>
        <form onSubmit={e => { e.preventDefault(); load(ghUsername); }} style={{ display: 'flex', gap: 12 }}>
          <input className="dp-input" placeholder="GitHub username..." value={ghUsername} onChange={e => setGhUsername(e.target.value)} style={{ flex: 1 }} />
          <button className="dp-btn dp-btn-primary" type="submit" disabled={loading} style={{ minWidth: 140 }}>
            {loading ? <span className="dp-loader" style={{ width: 20, height: 20, borderWidth: 2 }} /> : '📊 View Profile'}
          </button>
        </form>
      </div>

      {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, color: 'var(--accent-red)', fontSize: 14 }}>{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div className="dp-loader" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading profile...</p>
        </div>
      )}

      {profile && !loading && (
        <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Top: Score + Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
            {/* Score Ring */}
            <div className="glass-card" style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <ScoreRing score={score} />
              <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>out of 100</div>
              <div style={{ marginTop: 12 }}>
                <span className={score >= 80 ? 'status-verified' : score >= 50 ? 'status-pending' : 'status-flagged'} style={{ padding: '8px 20px', fontSize: 13 }}>
                  {status}
                </span>
              </div>
            </div>

            {/* Stat Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <StatCard label="Total Repos" value={profile.total_repos} icon="📁" color="var(--accent-blue)" />
              <StatCard label="Total Commits" value={profile.total_commits} icon="🔄" color="var(--accent-teal)" />
              <StatCard label="Authorship" value={`${Math.round(profile.authorship_ratio)}%`} icon="✍️" color="var(--accent-purple)" />
              <StatCard label="Originality" value={`${profile.originality_score}%`} icon="🔬" color={profile.originality_score >= 80 ? 'var(--accent-green)' : 'var(--accent-orange)'} />
            </div>
          </div>

          {/* Metrics Breakdown */}
          {profile.trust_score && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>📋 Score Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <MetricBar label="Authorship Ratio" value={profile.authorship_ratio} icon="✍️" />
                <MetricBar label="Code Originality" value={profile.originality_score} icon="🔬" />
                <MetricBar label="Commit Volume" value={Math.min(profile.total_commits, 100)} max={100} icon="📊" />
              </div>
            </div>
          )}

          {/* Languages + Repos side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Language Distribution */}
            {profile.languages.length > 0 && (
              <div className="glass-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🌐 Language Distribution</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {profile.languages.slice(0, 6).map((lang, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>
                          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: langColors[lang.name] || '#888', marginRight: 8 }} />
                          {lang.name}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>{lang.count} repos · {lang.percent}%</span>
                      </div>
                      <div className="dp-progress" style={{ height: 6 }}>
                        <div className="dp-progress-fill" style={{ width: `${lang.percent}%`, background: langColors[lang.name] || '#888' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Repository Grid */}
            {profile.repos.length > 0 && (
              <div className="glass-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>📂 Repositories</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {profile.repos.slice(0, 12).map((repo, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{repo.is_forked ? '🔗' : '📦'} {repo.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8 }}>{repo.language}</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{repo.commits} commits</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass-card" style={{ padding: 24, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
            <button className="dp-btn dp-btn-primary" onClick={() => navigate('/github-analysis')} style={{ padding: '10px 24px' }}>🔍 Run New Analysis</button>
            <button className="dp-btn dp-btn-outline" onClick={() => navigate('/trustscore')} style={{ padding: '10px 24px' }}>⚡ Generate TrustScore</button>
            <a href={`https://github.com/${profile.username}`} target="_blank" rel="noreferrer" className="dp-btn dp-btn-github" style={{ padding: '10px 24px', textDecoration: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              View on GitHub
            </a>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!profile && !loading && !error && (
        <div className="glass-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Welcome to DevProof</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
            Enter your GitHub username above to see your developer trust profile, code originality analysis, and more.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Recruiter Dashboard ──
function RecruiterDashboard() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'trust_score' | 'originality' | 'total_repos'>('trust_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.dashboard.getRecruiter()
      .then(data => { setCandidates(data.data || []); setStats(data.stats || null); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filtered = candidates
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.github.toLowerCase().includes(searchTerm.toLowerCase()) || c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const av = typeof a[sortField] === 'number' ? a[sortField] as number : -1;
      const bv = typeof b[sortField] === 'number' ? b[sortField] as number : -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  const getScoreColor = (s: number) => s >= 80 ? 'var(--accent-green)' : s >= 50 ? 'var(--accent-orange)' : 'var(--accent-red)';
  const SortIcon = ({ field }: { field: typeof sortField }) => (
    <span style={{ marginLeft: 4, opacity: sortField === field ? 1 : 0.3, fontSize: 10 }}>{sortField === field && sortDir === 'asc' ? '▲' : '▼'}</span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, color: 'var(--accent-red)', fontSize: 14 }}>{error}</div>}

      {/* Stats Overview */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          <StatCard label="Total Candidates" value={stats.total_candidates} icon="👥" color="var(--accent-blue)" />
          <StatCard label="Avg TrustScore" value={stats.avg_trust_score} icon="📊" color="var(--accent-purple)" />
          <StatCard label="Verified" value={stats.verified_count} icon="✅" color="var(--accent-green)" />
          <StatCard label="Needs Review" value={stats.review_count + stats.pending_count} icon="⏳" color="var(--accent-orange)" />
          <StatCard label="Flagged" value={stats.flagged_count} icon="🚨" color="var(--accent-red)" />
        </div>
      )}

      {/* Score Distribution Bar */}
      {stats && stats.total_candidates > 0 && (
        <div className="glass-card" style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary)' }}>Score Distribution</div>
          <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
            {stats.verified_count > 0 && <div style={{ flex: stats.verified_count, background: 'var(--accent-green)', borderRadius: 3 }} title={`Verified: ${stats.verified_count}`} />}
            {stats.review_count > 0 && <div style={{ flex: stats.review_count, background: 'var(--accent-orange)', borderRadius: 3 }} title={`Review: ${stats.review_count}`} />}
            {stats.flagged_count > 0 && <div style={{ flex: stats.flagged_count, background: 'var(--accent-red)', borderRadius: 3 }} title={`Flagged: ${stats.flagged_count}`} />}
            {stats.pending_count > 0 && <div style={{ flex: stats.pending_count, background: 'rgba(255,255,255,.15)', borderRadius: 3 }} title={`Pending: ${stats.pending_count}`} />}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', marginRight: 4 }} />Verified (80+)</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-orange)', marginRight: 4 }} />Review (50-79)</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-red)', marginRight: 4 }} />Flagged (&lt;50)</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,.15)', marginRight: 4 }} />Pending</span>
          </div>
        </div>
      )}

      {/* Search + Table */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input className="dp-input" placeholder="Search by name, email, or GitHub..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ maxWidth: 380 }} />
        <div style={{ marginLeft: 'auto', padding: '10px 18px', background: 'rgba(139,92,246,.1)', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'var(--accent-purple)' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="dp-loader" style={{ margin: '0 auto' }} /></div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="dp-table">
            <thead><tr>
              <th>Candidate</th>
              <th>GitHub</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('total_repos')}>Repos <SortIcon field="total_repos" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('originality')}>Originality <SortIcon field="originality" /></th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('trust_score')}>TrustScore <SortIcon field="trust_score" /></th>
              <th>Status</th>
              <th>Action</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.email}</div>
                  </td>
                  <td>
                    {c.github ? <a href={`https://github.com/${c.github}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: 13 }}>@{c.github}</a> : '—'}
                  </td>
                  <td>{c.total_repos}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="dp-progress" style={{ width: 60, height: 6 }}>
                        <div className="dp-progress-fill" style={{ width: `${c.originality}%`, background: c.originality >= 80 ? 'var(--accent-green)' : c.originality >= 60 ? 'var(--accent-orange)' : 'var(--accent-red)' }} />
                      </div>
                      <span style={{ fontSize: 13 }}>{c.originality}%</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: typeof c.trust_score === 'number' ? getScoreColor(c.trust_score) : 'var(--text-secondary)' }}>
                    {typeof c.trust_score === 'number' ? `${c.trust_score}/100` : c.trust_score}
                  </td>
                  <td>
                    <span className={c.status === 'Verified' ? 'status-verified' : c.status === 'Flagged' ? 'status-flagged' : 'status-pending'}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    {c.github && (
                      <button className="dp-btn dp-btn-outline" style={{ padding: '6px 14px', fontSize: 12 }}
                        onClick={() => navigate(`/github-analysis`)}>
                        Analyze
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                  {candidates.length === 0 ? '📭 No candidates analyzed yet. Candidates need to run GitHub Analysis first.' : 'No results match your search.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ──
export default function DashboardPage() {
  const { user } = useAuth();
  const isRecruiter = user?.role === 'recruiter';

  return (
    <div className="page-container">
      <div className="animate-fadeIn" style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 4 }}>
              <span className="gradient-text">{isRecruiter ? 'Recruiter Dashboard' : 'My Dashboard'}</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {isRecruiter ? 'Evaluate, compare, and manage candidate trust profiles.' : 'View your developer trust profile and code analysis.'}
            </p>
          </div>
          <div style={{ padding: '8px 16px', background: 'rgba(139,92,246,.1)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--accent-purple)' }}>
            {isRecruiter ? '🏢 Recruiter' : '👤 Candidate'}
          </div>
        </div>

        {isRecruiter ? <RecruiterDashboard /> : <CandidateDashboard />}
      </div>
    </div>
  );
}

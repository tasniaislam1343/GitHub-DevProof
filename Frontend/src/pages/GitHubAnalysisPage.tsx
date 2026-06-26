import { useState } from 'react';
import { api } from '@/services/api';

interface AnalysisResult {
  total_repos: number;
  original_repos: number;
  forked_repos: number;
  total_recent_commits: number;
  authorship_ratio: number;
  originality_score: number;
  suspicious_pattern_flag: string;
  repo_breakdown: Array<{ name: string; commits: number; language: string; stars: number }>;
  similarity_details: Array<{ repo_a: string; repo_b: string; moss_similarity: number; devproof_similarity: number }>;
  cross_repo_analysis: {
    external_matches_found: number;
    top_external_matches: Array<{ user_repo: string; external_repo: string; external_url: string; moss_similarity: number; devproof_similarity: number }>;
    overall_moss_score: number;
    overall_devproof_score: number;
  };
  engines: { moss: { internal_score: number; cross_repo_score: number; overall: number }; devproof: { internal_score: number; cross_repo_score: number; overall: number } };
  code_snippets: {
    user_code: Array<{ repo: string; language: string; code: string; matched_external: { repo: string; owner: string; url: string; code: string; moss_similarity: number; devproof_similarity: number } | null }>;
    external_code: Array<{ repo: string; owner: string; url: string; code: string }>;
  };
}

export default function GitHubAnalysisPage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [candidate, setCandidate] = useState('');
  const [codeTab, setCodeTab] = useState(0);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setError(''); setLoading(true); setResult(null);
    try {
      const data = await api.github.analyze(username.trim());
      setResult(data.analysis_results);
      setCandidate(data.candidate);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => score >= 80 ? 'var(--accent-green)' : score >= 60 ? 'var(--accent-orange)' : 'var(--accent-red)';

  return (
    <div className="page-container">
      <div className="animate-fadeIn" style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          <span className="gradient-text">GitHub Analysis</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Deep analysis engine — fetches repos, commits, languages, and detects suspicious patterns across all of GitHub.</p>

        <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <input className="dp-input" placeholder="Enter GitHub username..." value={username} onChange={e => setUsername(e.target.value)} style={{ flex: 1 }} />
          <button className="dp-btn dp-btn-primary" type="submit" disabled={loading} style={{ minWidth: 140 }}>
            {loading ? <span className="dp-loader" style={{ width: 20, height: 20, borderWidth: 2 }} /> : '🔍 Analyze'}
          </button>
        </form>

        {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: 'var(--accent-red)', fontSize: 14, marginBottom: 24 }}>{error}</div>}

        {loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div className="dp-loader" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Analyzing GitHub profile... This may take 30-60 seconds.</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>Fetching repos, analyzing code, searching across GitHub...</p>
          </div>
        )}

        {result && (
          <div className="animate-slideUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {[
                { label: 'Originality Score', value: `${result.originality_score}%`, color: getScoreColor(result.originality_score) },
                { label: 'Total Repos', value: result.total_repos, color: 'var(--accent-blue)' },
                { label: 'Original Repos', value: result.original_repos, color: 'var(--accent-teal)' },
                { label: 'Recent Commits', value: result.total_recent_commits, color: 'var(--accent-purple)' },
              ].map((card, i) => (
                <div key={i} className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>{card.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* Suspicious Flag */}
            {result.suspicious_pattern_flag !== 'Clean' && (
              <div style={{ padding: '14px 18px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, color: 'var(--accent-red)', fontSize: 14 }}>
                ⚠️ {result.suspicious_pattern_flag}
              </div>
            )}
            {result.suspicious_pattern_flag === 'Clean' && (
              <div style={{ padding: '14px 18px', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 12, color: 'var(--accent-green)', fontSize: 14 }}>
                ✅ No suspicious patterns detected — Profile looks clean.
              </div>
            )}

            {/* MOSS vs DevProof Engine Comparison */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>🔬 MOSS vs DevProof Engine Comparison</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* MOSS */}
                <div style={{ padding: 20, background: 'rgba(255,255,255,.03)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-orange)', marginBottom: 12 }}>MOSS (Winnowing)</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>{result.engines.moss.overall.toFixed(1)}%</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Internal: {result.engines.moss.internal_score.toFixed(1)}% | Cross-repo: {result.engines.moss.cross_repo_score.toFixed(1)}%</div>
                  <div className="dp-progress" style={{ marginTop: 12 }}>
                    <div className="dp-progress-fill" style={{ width: `${result.engines.moss.overall}%`, background: 'var(--accent-orange)' }} />
                  </div>
                </div>
                {/* DevProof */}
                <div style={{ padding: 20, background: 'rgba(139,92,246,.05)', borderRadius: 12, border: '1px solid rgba(139,92,246,.2)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-purple)', marginBottom: 12 }}>DevProof Enhanced</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>{result.engines.devproof.overall.toFixed(1)}%</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Internal: {result.engines.devproof.internal_score.toFixed(1)}% | Cross-repo: {result.engines.devproof.cross_repo_score.toFixed(1)}%</div>
                  <div className="dp-progress" style={{ marginTop: 12 }}>
                    <div className="dp-progress-fill" style={{ width: `${result.engines.devproof.overall}%` }} />
                  </div>
                </div>
              </div>

              {/* Why DevProof is Better */}
              <div style={{ marginTop: 24, padding: 20, background: 'rgba(139,92,246,.05)', borderRadius: 12, border: '1px solid rgba(139,92,246,.15)' }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: 'var(--accent-purple)' }}>💡 Why DevProof is Better Than MOSS</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--accent-orange)' }}>MOSS (Single Technique)</div>
                    <ul style={{ listStyle: 'disc', paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                      <li>Uses only Winnowing fingerprinting</li>
                      <li>Misses variable renaming</li>
                      <li>Can't detect structural reorganization</li>
                      <li>Fooled by whitespace obfuscation</li>
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--accent-purple)' }}>DevProof (4 Techniques Combined)</div>
                    <ul style={{ listStyle: 'disc', paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                      <li>SequenceMatcher (20%) — structural text</li>
                      <li>3-gram analysis (25%) — token patterns</li>
                      <li>Winnowing (25%) — fingerprints</li>
                      <li>TF-IDF (30%) — rare token weighting</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Side-by-side Code Comparison */}
            {result.code_snippets && result.code_snippets.user_code.length > 0 && (
              <div className="glass-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>📄 Side-by-Side Code Comparison</h3>
                {result.code_snippets.user_code.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {result.code_snippets.user_code.map((s, i) => {
                      const hasMatch = !!s.matched_external;
                      return (
                        <button key={i} onClick={() => setCodeTab(i)}
                          style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${codeTab === i ? 'var(--accent-purple)' : 'var(--border-subtle)'}`, background: codeTab === i ? 'rgba(139,92,246,.15)' : 'transparent', color: codeTab === i ? 'var(--accent-purple)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, position: 'relative' }}>
                          {s.repo}
                          {hasMatch && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent-orange)' }}>⚠</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {(() => {
                  const currentUserCode = result.code_snippets.user_code[codeTab];
                  const matchedExt = currentUserCode?.matched_external;
                  return (
                    <>
                      {matchedExt && (
                        <div style={{ padding: '8px 14px', marginBottom: 16, background: 'rgba(139,92,246,.08)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 16, alignItems: 'center' }}>
                          <span>Similarity: <strong style={{ color: 'var(--accent-purple)' }}>DevProof {matchedExt.devproof_similarity.toFixed(1)}%</strong></span>
                          <span>|</span>
                          <span>MOSS: <strong style={{ color: 'var(--accent-orange)' }}>{matchedExt.moss_similarity.toFixed(1)}%</strong></span>
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="code-panel">
                          <div className="code-panel-header">👤 {candidate}'s Code — {currentUserCode?.repo} ({currentUserCode?.language})</div>
                          <pre>{currentUserCode?.code || 'No code available'}</pre>
                        </div>
                        <div className="code-panel">
                          <div className="code-panel-header">
                            🌐 External Match — {matchedExt ? `${matchedExt.owner}/${matchedExt.repo}` : 'No external matches for this repo'}
                          </div>
                          <pre>{matchedExt?.code || '✅ No external code matches found for this repo — the code appears original!'}</pre>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Repo Breakdown */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>📊 Repository Breakdown</h3>
              <table className="dp-table">
                <thead><tr><th>Repository</th><th>Language</th><th>Commits</th><th>Stars</th></tr></thead>
                <tbody>
                  {result.repo_breakdown.map((repo, i) => (
                    <tr key={i}><td style={{ fontWeight: 500 }}>{repo.name}</td><td>{repo.language}</td><td>{repo.commits}</td><td>⭐ {repo.stars}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cross-repo Matches */}
            {result.cross_repo_analysis.external_matches_found > 0 && (
              <div className="glass-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>🌍 Cross-Repository Matches ({result.cross_repo_analysis.external_matches_found} found)</h3>
                <table className="dp-table">
                  <thead><tr><th>User Repo</th><th>External Match</th><th>MOSS %</th><th>DevProof %</th></tr></thead>
                  <tbody>
                    {result.cross_repo_analysis.top_external_matches.map((m, i) => (
                      <tr key={i}>
                        <td>{m.user_repo}</td>
                        <td><a href={m.external_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>{m.external_repo}</a></td>
                        <td style={{ color: 'var(--accent-orange)' }}>{m.moss_similarity.toFixed(1)}%</td>
                        <td style={{ color: 'var(--accent-purple)' }}>{m.devproof_similarity.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

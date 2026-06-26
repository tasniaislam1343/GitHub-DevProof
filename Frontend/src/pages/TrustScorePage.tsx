import { useState } from 'react';
import { api } from '@/services/api';

interface TrustResult {
  authorship_grade: string;
  volume_grade: string;
  originality_grade: string;
  FINAL_TRUST_SCORE: string;
  status: string;
}

export default function TrustScorePage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TrustResult | null>(null);
  const [candidate, setCandidate] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setError(''); setLoading(true); setResult(null);
    try {
      const data = await api.trustscore.generate(username.trim());
      setResult(data.report_card);
      setCandidate(data.candidate);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate TrustScore');
    } finally {
      setLoading(false);
    }
  };

  const parseScore = (s: string) => parseInt(s.split('/')[0].trim());
  const score = result ? parseScore(result.FINAL_TRUST_SCORE) : 0;
  const isVerified = result?.status.includes('Verified');

  const getScoreColor = (s: number) => s >= 80 ? 'var(--accent-green)' : s >= 50 ? 'var(--accent-orange)' : 'var(--accent-red)';

  return (
    <div className="page-container">
      <div className="animate-fadeIn" style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
          <span className="gradient-text">TrustScore</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Convert GitHub analysis into a credibility score (0–100). Run GitHub Analysis first, then generate the score.</p>

        <form onSubmit={handleGenerate} style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <input className="dp-input" placeholder="Enter GitHub username (must be analyzed first)..." value={username} onChange={e => setUsername(e.target.value)} style={{ flex: 1 }} />
          <button className="dp-btn dp-btn-primary" type="submit" disabled={loading} style={{ minWidth: 160 }}>
            {loading ? <span className="dp-loader" style={{ width: 20, height: 20, borderWidth: 2 }} /> : '⚡ Generate Score'}
          </button>
        </form>

        {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, color: 'var(--accent-red)', fontSize: 14, marginBottom: 24 }}>{error}</div>}

        {loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div className="dp-loader" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Calculating TrustScore...</p>
          </div>
        )}

        {result && (
          <div className="animate-slideUp" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Big Score Circle */}
            <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>TrustScore for <strong style={{ color: 'var(--text-primary)' }}>{candidate}</strong></p>
              <div className="score-circle" style={{ margin: '0 auto', background: 'var(--bg-card)', color: getScoreColor(score) }}>
                {score}
              </div>
              <p style={{ fontSize: 14, marginTop: 16, fontWeight: 600 }}>out of 100</p>
              <div style={{ marginTop: 16 }}>
                <span className={isVerified ? 'status-verified' : 'status-flagged'} style={{ fontSize: 14, padding: '8px 20px' }}>
                  {result.status}
                </span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>📋 Score Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  { label: 'Authorship Ratio', value: result.authorship_grade, icon: '📝' },
                  { label: 'Commit Volume', value: result.volume_grade, icon: '📊' },
                  { label: 'Code Originality', value: result.originality_grade, icon: '🔍' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: 16, background: 'rgba(255,255,255,.03)', borderRadius: 12, border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{item.icon} {item.label}</span>
                      <span style={{ fontSize: 13, color: item.value.includes('Pass') ? 'var(--accent-green)' : item.value.includes('Warning') || item.value.includes('Suspicious') ? 'var(--accent-orange)' : item.value.includes('Critical') ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                        {item.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interpretation */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>🧠 What This Means</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 14 }}>
                {score >= 80
                  ? `This candidate has a strong TrustScore of ${score}/100. Their GitHub profile shows consistent activity, original work, and no suspicious patterns. DevProof recommends this candidate as verified.`
                  : score >= 50
                  ? `This candidate has a moderate TrustScore of ${score}/100. Some areas need attention — check the breakdown for specific warnings. Further review is recommended.`
                  : `This candidate has a low TrustScore of ${score}/100. Significant concerns were detected in their GitHub profile. This could indicate copied code, fake activity, or lack of genuine contributions.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

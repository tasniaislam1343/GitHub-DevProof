import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [name, setName]=useState(" ");
  const [password, setPassword] = useState('');
  const [github, setGithub] = useState('');
  const [role, setRole] = useState('candidate');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauthAttempted = useRef(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  // Handle GitHub OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !oauthAttempted.current) {
      oauthAttempted.current = true; // Prevents React 18 Strict Mode from calling this twice
      
      // Remove code from URL immediately so StrictMode doesn't trigger it twice causing a 401
      window.history.replaceState({}, document.title, window.location.pathname);
      
      setLoading(true);
      const savedRole = sessionStorage.getItem('oauth_role') || role;
      api.auth.githubLogin(code, savedRole)
        .then(data => { 
          sessionStorage.removeItem('oauth_role');
          login(data.token, data.user); 
          navigate('/dashboard'); 
        })
        .catch(err => { 
          setError(err.message); 
          setLoading(false); 
        });
    }
  }, [searchParams, role, login, navigate]);

  // Handle Google OAuth Initialization
  useEffect(() => {
    const loadGoogleScript = () => {
      if (document.getElementById('google-jssdk')) return;
      const script = document.createElement('script');
      script.id = 'google-jssdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => {
        const win = window as any;
        if (win.google) {
          win.google.accounts.id.initialize({
            client_id: '654749721744-1i3ldqosa44diiril59ma4tlcao49af4.apps.googleusercontent.com',
            callback: (response: any) => {
              setLoading(true);
              const currentRole = sessionStorage.getItem('oauth_role') || role;
              api.auth.googleLogin(response.credential, currentRole)
                .then(data => {
                  sessionStorage.removeItem('oauth_role');
                  login(data.token, data.user);
                  navigate('/dashboard');
                })
                .catch(err => {
                  setError(err.message);
                  setLoading(false);
                });
            }
          });
          
          // Render the official Google Sign-In button
          const googleBtnContainer = document.getElementById('google-btn-container');
          if (googleBtnContainer) {
            win.google.accounts.id.renderButton(googleBtnContainer, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left'
            });
          }
        }
      };
      document.body.appendChild(script);
    };
    loadGoogleScript();
  }, [role, login, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        const data = await api.auth.login(email, password);
        login(data.token, data.user);
      } else {
        const data = await api.auth.register(email, password, role, github || undefined);
        login(data.token, data.user);
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLogin = () => {
    sessionStorage.setItem('oauth_role', role);
    const clientId = 'Ov23lij21R6FYo68hiML';
    const redirectUri = `${window.location.origin}/login`;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  };

  const handleGoogleLogin = () => {
    sessionStorage.setItem('oauth_role', role);
    // The visual Google button triggers its own login flow when clicked
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 24 }}>
      {/* Background effects */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.08) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.06) 0%, transparent 70%)' }} />
      </div>

      <div className="glass-card animate-scaleIn" style={{ width: '100%', maxWidth: 440, padding: 40, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>
            <span className="gradient-text">DevProof</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 8 }}>Developer Trust Platform</p>
        </div>

        {/* Tabs */}
        <div className="dp-tabs" style={{ marginBottom: 24 }}>
          <button className={`dp-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')} style={{ flex: 1 }}>Sign In</button>
          <button className={`dp-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => setTab('signup')} style={{ flex: 1 }}>Sign Up</button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: 'var(--accent-red)', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Email</label>
              <input className="dp-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
              <input className="dp-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>

            {tab === 'signup' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>GitHub Username (optional)</label>
                  <input className="dp-input" type="text" placeholder="octocat" value={github} onChange={e => setGithub(e.target.value)} />
                </div>
              </>
            )}

            <button className="dp-btn dp-btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
              {loading ? <span className="dp-loader" style={{ width: 20, height: 20, borderWidth: 2 }} /> : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>or continue with</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, textAlign: 'center' }}>
            Select your role before using Google or GitHub
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {['candidate', 'recruiter'].map(r => (
              <button key={r} type="button" onClick={() => setRole(r)}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 8, border: `1px solid ${role === r ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                  background: role === r ? 'rgba(139,92,246,.15)' : 'transparent', color: role === r ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, textTransform: 'capitalize', transition: 'all .2s'
                }}>
                {r === 'candidate' ? '👤 Candidate' : '🏢 Recruiter'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="dp-btn dp-btn-github" onClick={handleGitHubLogin} style={{ flex: 1, padding: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </button>
          
          <div 
            style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 8, height: 40 }} 
            onClick={handleGoogleLogin}
            onMouseEnter={() => sessionStorage.setItem('oauth_role', role)}
          >
            {/* The original custom visual button */}
            <button className="dp-btn dp-btn-google" style={{ width: '100%', height: '100%', margin: 0, pointerEvents: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>

            {/* The invisible official Google iframe that intercepts clicks */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.01, zIndex: 10 }}>
              <div id="google-btn-container" style={{ width: '100%', height: '100%' }}></div>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', marginTop: 24 }}>
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setTab(tab === 'login' ? 'signup' : 'login')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-purple)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>
            {tab === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

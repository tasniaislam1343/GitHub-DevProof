const API_BASE = '/api';

async function request(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('dp_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (!res.ok) {
    let errorMessage = 'Request failed';
    try {
      const data = await res.json();
      errorMessage = data.error || errorMessage;
    } catch {
      errorMessage = `Server error: ${res.status} ${res.statusText}`;
    }
    throw new Error(errorMessage);
  }

  const data = await res.json();
  return data;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (email: string, password: string, role: string, github_username?: string) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, role, github_username }) }),
    githubLogin: (code: string, role?: string) =>
      request('/auth/github', { method: 'POST', body: JSON.stringify({ code, role }) }),
    googleLogin: (credential: string, role?: string) =>
      request('/auth/google', { method: 'POST', body: JSON.stringify({ credential, role }) }),
  },
  github: {
    analyze: (username: string) => request(`/github/${username}`),
  },
  trustscore: {
    generate: (username: string) => request(`/trustscore/${username}`),
  },
  dashboard: {
    getRecruiter: () => request('/dashboard/recruiter'),
    getCandidateProfile: (username: string) => request(`/dashboard/candidate/${username}`),
  },
};

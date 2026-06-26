import React from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link, Navigate } from "react-router-dom";
import { Shield, GitBranch, Award, LayoutDashboard } from "lucide-react";
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LoginPage from "@/pages/LoginPage";
import GitHubAnalysisPage from "@/pages/GitHubAnalysisPage";
import TrustScorePage from "@/pages/TrustScorePage";
import DashboardPage from "@/pages/DashboardPage";

const timelineData = [
  {
    id: 1,
    title: "Authentication",
    date: "Feature 1",
    content: "Register, login, and manage users. Supports Gmail & GitHub OAuth with role selection (Candidate / Recruiter).",
    category: "Auth",
    icon: Shield,
    relatedIds: [4],
    status: "completed" as const,
    energy: 100,
    route: "/login",
  },
  {
    id: 2,
    title: "GitHub Analysis",
    date: "Feature 2",
    content: "Fetch repos, commits, and languages. Detect suspicious patterns and analyze code similarity across all of GitHub.",
    category: "Analysis",
    icon: GitBranch,
    relatedIds: [3],
    status: "completed" as const,
    energy: 90,
    route: "/github-analysis",
  },
  {
    id: 3,
    title: "TrustScore",
    date: "Feature 3",
    content: "Convert GitHub analysis into a credibility score (0–100). Evaluates authorship, activity, consistency, and originality.",
    category: "Score",
    icon: Award,
    relatedIds: [2, 4],
    status: "completed" as const,
    energy: 85,
    route: "/trustscore",
  },
  {
    id: 4,
    title: "Dashboard",
    date: "Feature 4",
    content: "Candidate view: see your own TrustScore. Recruiter view: evaluate and compare candidate profiles at a glance.",
    category: "Dashboard",
    icon: LayoutDashboard,
    relatedIds: [1, 3],
    status: "completed" as const,
    energy: 80,
    route: "/dashboard",
  },
];

function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  if (location.pathname === "/" || location.pathname === "/login") return null;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="gradient-text">DevProof</span>
      </Link>
      <div className="navbar-links">
        <Link to="/github-analysis" className={location.pathname === '/github-analysis' ? 'active' : ''}>Analysis</Link>
        <Link to="/trustscore" className={location.pathname === '/trustscore' ? 'active' : ''}>TrustScore</Link>
        <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
        {isAuthenticated ? (
          <>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px' }}>{user?.email}</span>
            <button onClick={logout} className="dp-btn dp-btn-outline" style={{ padding: '8px 16px', fontSize: 13 }}>Logout</button>
          </>
        ) : (
          <Link to="/login" className="dp-btn dp-btn-primary" style={{ padding: '8px 16px', fontSize: 13, textDecoration: 'none' }}>Sign In</Link>
        )}
      </div>
    </nav>
  );
}

function LandingPage() {
  const navigate = useNavigate();
  return <RadialOrbitalTimeline timelineData={timelineData} onNavigate={(route) => navigate(route)} />;
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/github-analysis" element={<GitHubAnalysisPage />} />
        <Route path="/trustscore" element={<TrustScorePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface UserData {
  id: number;
  email: string;
  role: string;
  github: string | null;
}

interface AuthContextType {
  user: UserData | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: UserData) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(() => {
    const saved = localStorage.getItem('dp_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dp_token'));

  const login = (newToken: string, newUser: UserData) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('dp_token', newToken);
    localStorage.setItem('dp_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('dp_token');
    localStorage.removeItem('dp_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

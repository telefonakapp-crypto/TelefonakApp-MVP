import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AdminUser, AuthSession } from '../types/auth';
import {
  clearSession,
  getStoredToken,
  getStoredUser,
  storeSession,
} from '../utils/storage';

type AuthContextValue = {
  user: AdminUser | null;
  token: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isAuthenticated: boolean;
  login: (session: AuthSession) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AdminUser | null>(() => getStoredUser());

  const login = useCallback((session: AuthSession) => {
    storeSession(session.token, session.user);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      // Any active account in the admins table may use Admin Web.
      isAdmin: Boolean(user && user.is_active !== false),
      isSuperAdmin: Boolean(user && user.is_active !== false && user.role === 'super_admin'),
      isAuthenticated: Boolean(token && user),
      login,
      logout,
    }),
    [user, token, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AdminUser, AuthSession } from '../types/auth';
import { roleHasPermission } from '../auth/permissions';
import { fetchCurrentAdmin } from '../services/authService';
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
  hasPermission: (permission: string) => boolean;
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

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;
    fetchCurrentAdmin()
      .then((admin) => {
        if (cancelled) return;
        setUser(admin);
        storeSession(token, admin);
      })
      .catch(() => {
        // 401 interceptor already clears the session.
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user || user.is_active === false) return false;
      // Always intersect with the role map so a tampered permissions array
      // cannot reveal mutation controls the role does not have.
      if (!roleHasPermission(user.role, permission)) return false;
      if (Array.isArray(user.permissions)) {
        return user.permissions.includes(permission);
      }
      return true;
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      // Any active account in the admins table may use Admin Web.
      isAdmin: Boolean(user && user.is_active !== false),
      isSuperAdmin: Boolean(
        user && user.is_active !== false && user.role === 'super_admin'
      ),
      isAuthenticated: Boolean(token && user),
      hasPermission,
      login,
      logout,
    }),
    [user, token, hasPermission, login, logout]
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

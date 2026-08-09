import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, client, getTokens, clearTokens, setTokens } from './api';
import type { ClientInfo, UserProfile } from '../types';

export { ApiError };

interface AuthContextValue {
  user: UserProfile | null;
  clientInfo: ClientInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (input: { fullName: string; email: string; phone: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    if (!getTokens()) {
      setLoading(false);
      return;
    }
    try {
      const me = await client.get<{ user: UserProfile; client: ClientInfo | null }>('/auth/me');
      setUser(me.user);
      setClientInfo(me.client);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearTokens();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const json = await client.post<{
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      user: UserProfile;
      client: ClientInfo | null;
    }>('/auth/login', { email, password });
    setTokens({
      accessToken: json.accessToken,
      refreshToken: json.refreshToken,
      expiresAt: json.expiresAt
    });
    setUser(json.user);
    setClientInfo(json.client);
    return json.user;
  }, []);

  const register = useCallback(
    async (input: { fullName: string; email: string; phone: string; password: string }) => {
      await client.post('/auth/register', input);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await client.post('/auth/logout');
    } catch {
      // local cleanup regardless
    }
    clearTokens();
    setUser(null);
    setClientInfo(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, clientInfo, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
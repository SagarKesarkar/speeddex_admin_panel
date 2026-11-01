import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import type { Me } from './api/types';

type Auth = {
  me: Me | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    api.onSignedOut = () => {
      setMe(null);
      qc.clear();
    };
    if (!api.hasSession) {
      setReady(true);
      return;
    }
    api
      .get<Me>('/v1/admin/me')
      .then(setMe)
      .catch(() => api.logout())
      .finally(() => setReady(true));
  }, [qc]);

  const signIn = useCallback(async (email: string, password: string) => {
    await api.login(email, password);
    try {
      setMe(await api.get<Me>('/v1/admin/me'));
    } catch (e) {
      await api.logout();
      if (e instanceof ApiError && e.status === 403) {
        throw new ApiError(403, 'FORBIDDEN', "This account doesn't have access to the admin console.");
      }
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    setMe(null);
    qc.clear();
  }, [qc]);

  return <Ctx.Provider value={{ me, ready, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAuth outside AuthProvider');
  return a;
}

/** True for admins; moderators get the review tools only. The server checks again. */
export const useIsAdmin = () => useAuth().me?.role === 'admin';

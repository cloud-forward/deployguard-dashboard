import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { LoginResponse, UserSummaryResponse } from '../api/model';
import {
  AUTH_CHANGED_EVENT,
  clearStoredAuthSession,
  createSessionFromLoginResponse,
  getStoredAuthSession,
  type AuthSession,
  setStoredAuthSession,
} from './session';

interface AuthContextValue {
  isAuthenticated: boolean;
  isHydrated: boolean;
  session: AuthSession | null;
  user: UserSummaryResponse | null;
  login: (response: LoginResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setSession(getStoredAuthSession());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncSession = () => {
      setSession(getStoredAuthSession());
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === 'deployguard.auth.session') {
        syncSession();
      }
    };

    window.addEventListener(AUTH_CHANGED_EVENT, syncSession);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncSession);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(session?.accessToken),
      isHydrated,
      session,
      user: session?.user ?? null,
      login: (response) => {
        const nextSession = createSessionFromLoginResponse(response);
        setStoredAuthSession(nextSession);
        setSession(nextSession);
      },
      logout: () => {
        clearStoredAuthSession();
        setSession(null);
      },
    }),
    [isHydrated, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

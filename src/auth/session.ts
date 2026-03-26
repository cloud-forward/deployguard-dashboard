import type { LoginResponse, UserSummaryResponse } from '../api/model';

const AUTH_STORAGE_KEY = 'deployguard.auth.session';
const REMEMBERED_IDENTIFIER_KEY = 'deployguard.auth.rememberedIdentifier';
export const AUTH_CHANGED_EVENT = 'deployguard:auth-changed';

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  user: UserSummaryResponse;
}

const canUseStorage = () => typeof window !== 'undefined';

const emitAuthChanged = () => {
  if (!canUseStorage()) {
    return;
  }

  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
};

const isUserSummaryResponse = (value: unknown): value is UserSummaryResponse =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'email' in value &&
      'is_active' in value,
  );

const isAuthSession = (value: unknown): value is AuthSession =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'accessToken' in value &&
      'tokenType' in value &&
      'user' in value &&
      typeof (value as AuthSession).accessToken === 'string' &&
      typeof (value as AuthSession).tokenType === 'string' &&
      isUserSummaryResponse((value as AuthSession).user),
  );

export const createSessionFromLoginResponse = (response: LoginResponse): AuthSession => ({
  accessToken: response.access_token,
  tokenType: response.token_type,
  user: response.user,
});

export const getStoredAuthSession = (): AuthSession | null => {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const setStoredAuthSession = (session: AuthSession) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  emitAuthChanged();
};

export const clearStoredAuthSession = () => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  emitAuthChanged();
};

export const getAccessToken = () => getStoredAuthSession()?.accessToken ?? null;

export const getRememberedIdentifier = () => {
  if (!canUseStorage()) {
    return '';
  }

  return window.localStorage.getItem(REMEMBERED_IDENTIFIER_KEY) ?? '';
};

export const setRememberedIdentifier = (identifier: string) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, identifier);
};

export const clearRememberedIdentifier = () => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
};

/**
 * Auth utilities for the frontend.
 * Wraps API calls to /auth/* endpoints and manages session state.
 */
import { api, setAccessToken } from './api-client';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

interface AuthResponse {
  status: string;
  data: AuthTokens;
}

interface UserResponse {
  status: string;
  data: {
    id: string;
    email: string;
    role: string;
    mfaEnabled: boolean;
    createdAt: string;
  };
}

const REFRESH_TOKEN_KEY = 'om_refresh_token';

export async function register(email: string, password: string): Promise<AuthTokens> {
  const res = await api.post<AuthResponse>('/auth/register', { email, password });
  handleTokens(res.data);
  return res.data;
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await api.post<AuthResponse>('/auth/login', { email, password });
  handleTokens(res.data);
  return res.data;
}

export async function refresh(): Promise<AuthTokens | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const res = await api.post<AuthResponse>('/auth/refresh', { refreshToken });
    handleTokens(res.data);
    return res.data;
  } catch {
    logout();
    return null;
  }
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (refreshToken) {
    await api.post('/auth/logout', { refreshToken }).catch(() => {});
  }
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  setAccessToken(null);
}

export async function getMe() {
  const res = await api.get<UserResponse>('/auth/me');
  return res.data;
}

function handleTokens(tokens: AuthTokens) {
  setAccessToken(tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

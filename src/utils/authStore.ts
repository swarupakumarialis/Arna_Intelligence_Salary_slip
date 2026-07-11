import { AUTH_CONFIG } from '../config/authConfig';

/**
 * Simple-auth session store (Sprint 4). Deliberately uses
 * sessionStorage rather than the localStorage pattern every other
 * *Store.ts module in this app follows: a login session should
 * survive a page refresh (same tab) but must NOT persist once the
 * browser/tab closes, which is exactly sessionStorage's lifetime —
 * unlike employees, salary history, company settings, etc., which are
 * meant to persist indefinitely on the device.
 *
 * Migration path to JWT/MongoDB: this module is the ONLY place that
 * needs to change. `login()` would become async, POST credentials to
 * a real API, and store the returned JWT (still in sessionStorage, or
 * an httpOnly cookie if the backend sets one) instead of a plain
 * username. `getSession()` would validate/decode the token instead of
 * just parsing JSON. Every caller — useAuth(), ProtectedRoute,
 * LoginPage, TopNav — talks to this module's exported functions only,
 * never to sessionStorage or AUTH_CONFIG directly, so none of them
 * need to change when that swap happens.
 */
const SESSION_KEY = 'arna_auth_session_v1';

export interface AuthUser {
  username: string;
  loginAt: string;
}

/** Returns the logged-in user on success, or null on invalid credentials. */
export function login(username: string, password: string): AuthUser | null {
  if (username.trim() === AUTH_CONFIG.username && password === AUTH_CONFIG.password) {
    const user: AuthUser = { username: username.trim(), loginAt: new Date().toISOString() };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
    return user;
  }
  return null;
}

export function logout(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Reads the current session, if any — used both for the initial
    "am I already logged in" check and after every refresh. */
export function getSession(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

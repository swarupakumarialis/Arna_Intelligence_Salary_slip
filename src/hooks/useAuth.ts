import { useCallback, useState } from 'react';
import { AuthUser, getSession, login as loginRequest, logout as logoutRequest } from '../utils/authStore';

export interface UseAuthResult {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

/**
 * Thin React binding over utils/authStore.ts — every function here
 * maps 1:1 onto a function already exported by that module. Lazy
 * initial state (`getSession`) is what makes "stay logged in on
 * refresh" work: on mount, it reads whatever session already exists
 * rather than starting logged-out and waiting for an effect.
 *
 * Swapping the underlying auth implementation (see authStore.ts's
 * migration-path note) never touches this hook or any component that
 * calls it — only authStore.ts's internals change.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(getSession);

  const login = useCallback((username: string, password: string) => {
    const result = loginRequest(username, password);
    if (result) setUser(result);
    return result !== null;
  }, []);

  const logout = useCallback(() => {
    logoutRequest();
    setUser(null);
  }, []);

  return { user, isAuthenticated: !!user, login, logout };
}

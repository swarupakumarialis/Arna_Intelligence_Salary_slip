import React from 'react';
import { LoginPage } from '../../pages/LoginPage';

interface Props {
  isAuthenticated: boolean;
  onLogin: (username: string, password: string) => boolean;
  appName?: string;
  logoDataUri?: string | null;
  children: React.ReactNode;
}

/**
 * Single global route guard. The app has no client-side router — every
 * screen is a SidebarKey switch inside one page (see
 * components/layout/Sidebar.tsx) — so there's only one "route" to
 * protect: the whole app shell. This component is that guard: it
 * renders the login screen in place of `children` whenever there's no
 * active session.
 *
 * If a real router is introduced later, this is the same check a
 * per-route guard would wrap individual routes with — the pattern
 * doesn't change, just where it's applied.
 */
export function ProtectedRoute({ isAuthenticated, onLogin, appName, logoDataUri, children }: Props) {
  if (!isAuthenticated) {
    return <LoginPage onLogin={onLogin} appName={appName} logoDataUri={logoDataUri} />;
  }
  return <>{children}</>;
}

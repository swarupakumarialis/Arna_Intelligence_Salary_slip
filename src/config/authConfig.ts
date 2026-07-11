/**
 * Static credential configuration for the current simple-auth
 * implementation (Sprint 4). This is the single place the login
 * screen's accepted username/password live — swap or remove this file
 * when migrating to a real backend; utils/authStore.ts is the only
 * other file that reads it, and that's where the actual verification
 * call would change from a local comparison to an API request.
 */
export const AUTH_CONFIG = {
  username: 'ARNA@2026',
  password: 'ARNA@2026',
};

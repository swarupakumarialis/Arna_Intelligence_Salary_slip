import * as storageService from '../services/storage/storageService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

/**
 * Thin HTTP layer for the Google Drive OAuth connection (Sprint
 * 6.2A) — same division of responsibility as every other controller
 * in this app: no token handling, no Drive API calls here, all of
 * that lives in services/storage/. This file only ever returns
 * connection status fields (email, folder, timestamps) — never the
 * refresh token, access token, or client secret.
 */

/* The frontend is a single-page app with no URL router (activePage
   is plain React state — see App.tsx) — there is no real "/settings"
   route to redirect to. The root path is the only valid destination;
   App.tsx reads the `drive` query param on mount to land on Company
   Settings' Google Drive tab and show a connect/error notice, then
   strips the param from the URL. */
const FRONTEND_ROOT_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

export const getAuthUrl = asyncHandler(async (req, res) => {
  const url = storageService.getAuthUrl();
  res.status(200).json({ success: true, message: 'Authorization URL generated', data: { url } });
});

/**
 * Google redirects the browser here after the user grants (or
 * denies) consent. This is a browser navigation, not an API call
 * from the frontend — it always ends in a redirect back to Company
 * Settings, with a query flag the UI can read to show a toast.
 */
export const oauthCallback = asyncHandler(async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND_ROOT_URL}/?drive=error&reason=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return res.redirect(`${FRONTEND_ROOT_URL}/?drive=error&reason=missing_code`);
  }

  try {
    await storageService.connect(code);
    return res.redirect(`${FRONTEND_ROOT_URL}/?drive=connected`);
  } catch (err) {
    return res.redirect(`${FRONTEND_ROOT_URL}/?drive=error&reason=${encodeURIComponent(err.message || 'connection_failed')}`);
  }
});

export const getStatus = asyncHandler(async (req, res) => {
  const data = await storageService.getStatus();
  res.status(200).json({ success: true, message: 'Google Drive status fetched', data });
});

export const disconnect = asyncHandler(async (req, res) => {
  const data = await storageService.disconnect();
  res.status(200).json({ success: true, message: 'Google Drive disconnected', data });
});

export const testConnection = asyncHandler(async (req, res) => {
  try {
    const data = await storageService.testConnection();
    res.status(200).json({ success: true, message: 'Google Drive connection is healthy', data });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') {
      throw new AppError('Google Drive is not connected', 400);
    }
    throw new AppError(`Google Drive connection test failed: ${err.message}`, 502);
  }
});

/** Storage Used / Slips Stored / Last Uploaded File / Last Upload
    Time for the Company Settings Google Drive tab (Sprint 6.2B). */
export const getStorageStats = asyncHandler(async (req, res) => {
  try {
    const data = await storageService.getStorageStats();
    res.status(200).json({ success: true, message: 'Google Drive storage stats fetched', data });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') {
      throw new AppError('Google Drive is not connected', 400);
    }
    throw new AppError(`Unable to fetch Google Drive storage stats: ${err.message}`, 502);
  }
});

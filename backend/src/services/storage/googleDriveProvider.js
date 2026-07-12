import { google } from 'googleapis';
import { Readable } from 'stream';
import GoogleDriveConnection, { SINGLETON_ID } from '../../models/GoogleDriveConnection.js';

const ROOT_FOLDER_NAME = 'Arna Intelligence IntelliPayRoll';
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
];

/** No GOOGLE_REDIRECT_URI existed anywhere in this deployment before
    this sprint. The localhost fallback only helps local dev — on
    Render, GOOGLE_REDIRECT_URI must be set explicitly to match
    whatever "Authorized redirect URI" is registered on the OAuth
    Client in Google Cloud Console, or Google will reject the
    callback with redirect_uri_mismatch. */
function getRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `http://localhost:${process.env.PORT || 5000}/api/integrations/google-drive/callback`
  );
}

function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured');
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

/** Step 1 of the OAuth flow: the URL the browser is sent to. offline +
    consent are both required to guarantee a refresh_token comes back —
    Google only issues one on first consent (or when prompt=consent
    forces re-consent), never on a routine access_token refresh. */
export function getAuthUrl() {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

/** Step 2: exchanges the authorization code for tokens, resolves the
    connected account's email, and persists the refresh token — the
    only credential kept long-term, since access tokens are minted
    from it on demand. */
export async function completeConnection(code) {
  if (!code) {
    throw new Error('Missing authorization code');
  }
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Disconnect and reconnect, granting access again, to force one.'
    );
  }
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data: profile } = await oauth2.userinfo.get();

  const connection = await GoogleDriveConnection.findOneAndUpdate(
    { _id: SINGLETON_ID },
    {
      _id: SINGLETON_ID,
      refreshToken: tokens.refresh_token,
      googleEmail: profile.email || null,
      scopes: SCOPES,
      connectedAt: new Date(),
      lastVerifiedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { email: connection.googleEmail, connectedAt: connection.connectedAt };
}

/** Builds an authenticated OAuth2 client from the stored refresh
    token. google-auth-library mints/refreshes the access token
    transparently on every API call made through this client — no
    manual expiry tracking needed. */
async function getAuthenticatedClient() {
  const connection = await GoogleDriveConnection.findById(SINGLETON_ID).select('+refreshToken');
  if (!connection) {
    const err = new Error('Google Drive is not connected');
    err.code = 'NOT_CONNECTED';
    throw err;
  }
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: connection.refreshToken });

  // Google occasionally rotates the refresh token on use; persist it
  // if that happens so the next call doesn't go stale silently.
  client.on('tokens', (tokens) => {
    if (tokens.refresh_token && tokens.refresh_token !== connection.refreshToken) {
      GoogleDriveConnection.findByIdAndUpdate(SINGLETON_ID, {
        refreshToken: tokens.refresh_token,
      }).catch(() => {});
    }
  });

  return client;
}

async function getDrive() {
  const client = await getAuthenticatedClient();
  return google.drive({ version: 'v3', auth: client });
}

/** Finds a folder by exact name under parentId, creating it if
    absent. Always searches before creating, so re-running this never
    produces duplicate folders — satisfies "never create duplicate
    folders; reuse existing folders". */
async function findOrCreateFolder(drive, name, parentId) {
  const escapedName = name.replace(/'/g, "\\'");
  const parentClause = parentId ? `'${parentId}' in parents and ` : `'root' in parents and `;
  const query = `${parentClause}name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const { data } = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  const { data: created } = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
  });

  return created.id;
}

/** Resolves (creating as needed) "Arna Intelligence IntelliPayRoll" /
    Year / Month, and caches the root folder id on the connection
    document so repeat uploads skip the top-level lookup. */
async function resolveMonthFolder(drive, year, month) {
  let connection = await GoogleDriveConnection.findById(SINGLETON_ID);

  let rootFolderId = connection?.rootFolderId || null;
  if (!rootFolderId) {
    rootFolderId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME, null);
    await GoogleDriveConnection.findByIdAndUpdate(SINGLETON_ID, { rootFolderId });
  }

  const yearFolderId = await findOrCreateFolder(drive, String(year), rootFolderId);
  const monthFolderId = await findOrCreateFolder(drive, String(month), yearFolderId);
  return monthFolderId;
}

export async function uploadFile({ buffer, fileName, year, month }) {
  const drive = await getDrive();
  const folderId = await resolveMonthFolder(drive, year, month);

  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id, webViewLink',
  });

  await GoogleDriveConnection.findByIdAndUpdate(SINGLETON_ID, { lastVerifiedAt: new Date() });

  return { fileId: data.id, shareUrl: data.webViewLink || null };
}

async function removeFile(fileId) {
  const drive = await getDrive();
  await drive.files.delete({ fileId });
}

export { removeFile as delete };

export async function getFile(fileId) {
  const drive = await getDrive();
  const { data } = await drive.files.get({
    fileId,
    fields: 'id, name, webViewLink, createdTime, size',
  });
  return data;
}

export async function getStatus() {
  const connection = await GoogleDriveConnection.findById(SINGLETON_ID);
  if (!connection) {
    return { connected: false };
  }
  return {
    connected: true,
    email: connection.googleEmail,
    rootFolderName: connection.rootFolderName,
    connectedAt: connection.connectedAt,
    lastVerifiedAt: connection.lastVerifiedAt,
  };
}

export async function disconnect() {
  await GoogleDriveConnection.findByIdAndDelete(SINGLETON_ID);
  return { connected: false };
}

/** Lightweight call to prove the stored refresh token still works,
    for the optional "Run Connection Test" button. */
export async function testConnection() {
  const drive = await getDrive();
  const { data } = await drive.about.get({ fields: 'user' });
  await GoogleDriveConnection.findByIdAndUpdate(SINGLETON_ID, { lastVerifiedAt: new Date() });
  return { ok: true, user: data.user?.emailAddress || null };
}

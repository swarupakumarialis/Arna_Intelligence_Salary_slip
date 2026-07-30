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

/** Sprint 6.2B security requirement: uploaded salary slips must stay
    private to the connected Google account. This function
    deliberately never calls drive.permissions.create — a file
    created via a user's own OAuth Drive access is private to that
    account by default (no "anyone with the link" / public sharing)
    unless something explicitly grants it, and nothing in this module
    does. webViewLink (stored as shareUrl) still requires the viewer
    to be signed in as the connected account to open. */
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

const INVOICE_ROOT_FOLDER_NAME = 'Invoices';

/** Resolves (creating as needed) "Invoices" / Year, caching the
    invoice root folder id on the connection document — same pattern
    as resolveMonthFolder above, but a completely separate top-level
    tree (Sprint 5): this never reads or writes anything under
    ROOT_FOLDER_NAME/rootFolderId, keeping the Invoice PDF archive
    independent of the salary-slip Drive tree. */
async function resolveInvoiceYearFolder(drive, year) {
  const connection = await GoogleDriveConnection.findById(SINGLETON_ID);
  let invoiceFolderId = connection?.invoiceFolderId || null;
  if (!invoiceFolderId) {
    invoiceFolderId = await findOrCreateFolder(drive, INVOICE_ROOT_FOLDER_NAME, null);
    await GoogleDriveConnection.findByIdAndUpdate(SINGLETON_ID, { invoiceFolderId });
  }
  return findOrCreateFolder(drive, String(year), invoiceFolderId);
}

/** Same privacy invariant as uploadFile above: no
    drive.permissions.create call, so the invoice PDF stays private to
    the connected account, requiring the viewer be signed in as that
    account to open webViewLink. */
export async function uploadInvoiceFile({ buffer, fileName, year }) {
  const drive = await getDrive();
  const folderId = await resolveInvoiceYearFolder(drive, year);

  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id, webViewLink',
  });

  await GoogleDriveConnection.findByIdAndUpdate(SINGLETON_ID, { lastVerifiedAt: new Date() });

  return { fileId: data.id, shareUrl: data.webViewLink || null };
}

const PHOTO_ROOT_FOLDER_NAME = 'Employee Photos';
const PHOTO_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Employee profile pictures (Production Hotfix). Deliberately a
    separate top-level Drive folder from ROOT_FOLDER_NAME/
    resolveMonthFolder above — this never reads or writes anything
    under the salary-slip "Arna Intelligence IntelliPayRoll" tree, and
    that tree's own folder-resolution/caching (rootFolderId) is
    untouched. Same privacy invariant as uploadFile above: no
    drive.permissions.create call, so the file stays private to the
    connected account. */
async function resolvePhotoFolder(drive) {
  const connection = await GoogleDriveConnection.findById(SINGLETON_ID);
  let photoFolderId = connection?.photoFolderId || null;
  if (!photoFolderId) {
    photoFolderId = await findOrCreateFolder(drive, PHOTO_ROOT_FOLDER_NAME, null);
    await GoogleDriveConnection.findByIdAndUpdate(SINGLETON_ID, { photoFolderId });
  }
  return photoFolderId;
}

/** Bug fix (broken employee photo images), part 2: even with a
    working URL format, the file still 401s for any browser that
    isn't authenticated as this app's connected Drive account —
    confirmed live (a stored webViewLink returns 401/HTML when fetched
    unauthenticated). Employee photos are meant to be visible to
    whoever is using the Employee Directory in their own browser, not
    just someone signed into this backend's Google account, so
    (unlike uploadFile's salary slips, which must stay private — see
    that function's comment, untouched here) photos need a "reader,
    anyone with the link" grant to actually render. Checks existing
    permissions first so re-running this (e.g. via the repair script)
    doesn't pile up duplicate identical grants. */
async function grantPublicReadAccess(drive, fileId) {
  const { data } = await drive.permissions.list({ fileId, fields: 'permissions(id, type, role)' });
  const alreadyPublic = (data.permissions || []).some((p) => p.type === 'anyone' && p.role === 'reader');
  if (alreadyPublic) return;
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    fields: 'id',
  });
}

/** Sprint 6.2C.3 — stop guessing URL formats entirely (two prior
    attempts, lh3.googleusercontent.com/d/<id> and
    drive.google.com/uc?export=view&id=<id>, were both hand-built and
    both proved unreliable). Instead ask Drive itself what to use,
    via the exact field set Google documents for this purpose:
      - webViewLink     → Drive's HTML viewer page, not raw bytes. Out.
      - thumbnailLink   → looked promising (renders fine) but Google
                           documents it as short-lived, and it's
                           confirmed to actually rotate: fetching the
                           same file's metadata twice returns two
                           different thumbnailLink tokens. Wrong choice
                           for a URL persisted indefinitely in Mongo.
      - webContentLink  → Google's documented download-content link.
                           Confirmed stable across repeated fetches
                           (byte-for-byte identical), and confirmed to
                           serve the real image (200, image/jpeg or
                           image/png) once the file is
                           anyone-with-link-readable. This is what
                           gets stored.
    Called once right after upload (and by repairEmployeePhotoUrl
    below for pre-existing records) — never hand-constructed. */
async function fetchStableImageUrl(drive, fileId) {
  const { data } = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType,webViewLink,webContentLink,thumbnailLink,iconLink,imageMediaMetadata',
  });
  if (!data.webContentLink) {
    // Documented fallback (no case observed yet where this triggers,
    // but webContentLink's docs don't guarantee it's always present) —
    // Drive's own officially documented download endpoint, not a guess.
    return `https://drive.google.com/uc?id=${fileId}&export=download`;
  }
  return data.webContentLink;
}

export async function uploadEmployeePhoto({ buffer, employeeId, mimeType }) {
  const drive = await getDrive();
  const folderId = await resolvePhotoFolder(drive);
  const ext = PHOTO_MIME_EXTENSIONS[mimeType] || 'jpg';
  const safeEmployeeId = String(employeeId || 'unknown').replace(/[/\\]/g, '_');
  const fileName = `${safeEmployeeId}_${Date.now()}.${ext}`;

  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id',
  });

  await grantPublicReadAccess(drive, data.id);
  const url = await fetchStableImageUrl(drive, data.id);

  return { fileId: data.id, url };
}

/** Repairs an existing photoFileId's URL/permissions in place — for
    records uploaded before this fix. Does not re-upload or move
    anything; same file, same folder, just the permission grant +
    Drive-sourced URL this function was missing. Used by
    scripts/repairEmployeePhotoUrls.js. */
export async function repairEmployeePhotoUrl(fileId) {
  const drive = await getDrive();
  await grantPublicReadAccess(drive, fileId);
  return fetchStableImageUrl(drive, fileId);
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

/** Downloads a file's actual bytes (Sprint 6.2D) — distinct from
    getFile above, which only ever fetches metadata. Used solely by
    the employee-photo thumbnail migration
    (scripts/generateEmployeePhotoThumbnails.js) to read back an
    already-archived original so a thumbnail can be generated from it;
    never used in the salary-slip path. `alt: 'media'` is Drive API's
    documented way to request content instead of metadata;
    responseType 'arraybuffer' is required for binary (non-JSON)
    content with the googleapis client. */
export async function downloadFile(fileId) {
  const drive = await getDrive();
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data);
}

async function listChildren(drive, parentId, foldersOnly) {
  const mimeClause = foldersOnly
    ? " and mimeType = 'application/vnd.google-apps.folder'"
    : " and mimeType != 'application/vnd.google-apps.folder'";
  const { data } = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false${mimeClause}`,
    fields: 'files(id, name, size, createdTime)',
    spaces: 'drive',
    pageSize: 1000,
  });
  return data.files || [];
}

/** Storage stats (Sprint 6.2B) for the Company Settings Google Drive
    tab. The Drive API has no "size of this folder" call, so this
    walks root → year folders → month folders → files and sums as it
    goes — bounded by however many year/month folders this app has
    ever created (small, since it's one folder per calendar month),
    not by total Drive usage. Read-only; never called from the
    upload/email path, only when the tab is actually viewed. */
export async function getStorageStats() {
  const connection = await GoogleDriveConnection.findById(SINGLETON_ID);
  if (!connection || !connection.rootFolderId) {
    return { totalFiles: 0, totalStorageBytes: 0, lastUploadedFile: null, lastUploadedAt: null };
  }

  const drive = await getDrive();
  let totalFiles = 0;
  let totalStorageBytes = 0;
  let lastFile = null;

  const yearFolders = await listChildren(drive, connection.rootFolderId, true);
  for (const yearFolder of yearFolders) {
    const monthFolders = await listChildren(drive, yearFolder.id, true);
    for (const monthFolder of monthFolders) {
      const files = await listChildren(drive, monthFolder.id, false);
      for (const file of files) {
        totalFiles += 1;
        totalStorageBytes += Number(file.size) || 0;
        if (!lastFile || new Date(file.createdTime) > new Date(lastFile.createdTime)) {
          lastFile = file;
        }
      }
    }
  }

  return {
    totalFiles,
    totalStorageBytes,
    lastUploadedFile: lastFile ? lastFile.name : null,
    lastUploadedAt: lastFile ? lastFile.createdTime : null,
  };
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

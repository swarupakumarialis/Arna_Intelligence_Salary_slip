import mongoose from 'mongoose';

/**
 * The one Google Drive OAuth connection for this deployment (Sprint
 * 6.2A). There is no per-user auth in this app today (see
 * config/authConfig.js's shared HR login), so this is a singleton —
 * at most one document ever exists, upserted via the fixed
 * SINGLETON_ID below rather than a generated one, so "the current
 * connection" never needs a lookup-by-something-else.
 *
 * refreshToken is the one genuinely sensitive field here: it's what
 * lets this server mint new Drive access tokens indefinitely, so it
 * must never be sent to the frontend or logged (see
 * services/storage/googleDriveProvider.js and the controller, which
 * only ever return the *other* fields — email, folder, timestamps —
 * to the client).
 */
const googleDriveConnectionSchema = new mongoose.Schema(
  {
    refreshToken: { type: String, required: true, select: false },
    googleEmail: { type: String, trim: true, default: null },
    rootFolderId: { type: String, default: null },
    rootFolderName: { type: String, default: 'Arna Intelligence IntelliPayRoll' },
    /** Cached id of the separate "Employee Photos" root folder
        (Production Hotfix — employee profile pictures). Deliberately
        its own top-level folder, not nested under rootFolderId above:
        that field and everything under it stays exclusively the
        salary-slip archive tree, untouched by this feature. */
    photoFolderId: { type: String, default: null },
    scopes: { type: [String], default: [] },
    connectedAt: { type: Date, default: Date.now },
    lastVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const SINGLETON_ID = '000000000000000000000001';

export default mongoose.model('GoogleDriveConnection', googleDriveConnectionSchema);

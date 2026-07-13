import 'dotenv/config';
import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import { downloadFile } from '../services/storage/googleDriveProvider.js';
import { generateThumbnailDataUri } from '../services/thumbnail.service.js';

/**
 * One-time migration (Sprint 6.2D — Employee Photo Architecture
 * Finalization).
 *
 * The UI no longer renders Google Drive URLs at all (three prior
 * attempts at a reliable <img>-embeddable Drive URL — webViewLink,
 * lh3.googleusercontent.com, drive.google.com/uc?export=view — all
 * proved unreliable). Every component now renders only
 * Employee.photoDataUri, a small compressed thumbnail stored directly
 * in MongoDB. New uploads generate that thumbnail automatically (see
 * controllers/employee.controller.js's uploadPhoto). This script
 * back-fills it for employees who already have an original safely
 * archived in Drive (photoFileId set) from before that thumbnail step
 * existed, so nobody has to re-upload their photo.
 *
 * For every employee where photoDataUri is null and photoFileId is
 * set: downloads the original from Drive (drive.files.get with
 * alt:'media' — content, not metadata), generates the same
 * ~150x150 JPEG thumbnail the live upload path produces, and saves
 * it. Does not touch photoFileId/photoUrl or re-upload anything —
 * Drive remains untouched, this only ever reads from it.
 *
 * Usage:
 *   cd backend
 *   node src/scripts/generateEmployeePhotoThumbnails.js
 */

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[photo-thumbnails] MONGODB_URI is not set.');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri);
  console.log('[photo-thumbnails] Connected to MongoDB.');

  const candidates = await Employee.find({
    photoDataUri: null,
    photoFileId: { $ne: null },
  });
  console.log(`[photo-thumbnails] ${candidates.length} employee(s) need a thumbnail generated.`);

  let migrated = 0;
  let failed = 0;
  for (const emp of candidates) {
    try {
      const originalBuffer = await downloadFile(emp.photoFileId);
      const photoDataUri = await generateThumbnailDataUri(originalBuffer);
      await Employee.findByIdAndUpdate(emp._id, { photoDataUri });
      migrated += 1;
      console.log(`[photo-thumbnails] Generated thumbnail for ${emp.employeeId} — ${emp.fullName} (${photoDataUri.length} bytes as data URI)`);
    } catch (err) {
      failed += 1;
      console.error(`[photo-thumbnails] Failed for ${emp.employeeId} — ${emp.fullName}:`, err.message);
    }
  }

  console.log(`[photo-thumbnails] Done. ${migrated} migrated, ${failed} failed.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('[photo-thumbnails] Failed:', err);
  process.exitCode = 1;
});

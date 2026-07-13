import 'dotenv/config';
import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import { repairEmployeePhotoUrl } from '../services/storage/googleDriveProvider.js';

/**
 * One-time repair script (Production Hotfix — broken employee photo
 * images).
 *
 * Root cause history: photoUrl was originally stored as Drive's
 * webViewLink (an HTML viewer page, not raw image bytes). Two
 * follow-up attempts hand-built alternate URL formats
 * (lh3.googleusercontent.com/d/<id>, then
 * drive.google.com/uc?export=view&id=<id>) — both were guesses and
 * both proved unreliable in practice. Sprint 6.2C.3 stops guessing:
 * googleDriveProvider.js's repairEmployeePhotoUrl now asks Drive
 * itself, via drive.files.get(), which field it actually provides for
 * this (webContentLink — confirmed stable across repeated fetches,
 * unlike thumbnailLink which rotates on every call despite rendering
 * fine in a one-off test).
 *
 * This script re-derives photoUrl from Drive truth for every employee
 * that has a photoFileId — same file, same "Employee Photos" Drive
 * folder, no re-upload, just a fresh drive.files.get() + permission
 * check. Deliberately unconditional (no "does photoUrl already look
 * right" guess) so it also self-heals if Drive's behavior around any
 * of these fields ever changes — running it again is always safe.
 *
 * Usage:
 *   cd backend
 *   node src/scripts/repairEmployeePhotoUrls.js
 */

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[repair-photos] MONGODB_URI is not set.');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri);
  console.log('[repair-photos] Connected to MongoDB.');

  const candidates = await Employee.find({ photoFileId: { $ne: null } });
  console.log(`[repair-photos] ${candidates.length} record(s) with a stored photoFileId.`);

  let fixed = 0;
  let failed = 0;
  for (const emp of candidates) {
    try {
      const url = await repairEmployeePhotoUrl(emp.photoFileId);
      if (url !== emp.photoUrl) {
        await Employee.findByIdAndUpdate(emp._id, { photoUrl: url });
        fixed += 1;
        console.log(`[repair-photos] Updated ${emp.employeeId} — ${emp.fullName} -> ${url}`);
      } else {
        console.log(`[repair-photos] Already correct: ${emp.employeeId} — ${emp.fullName}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`[repair-photos] Failed for ${emp.employeeId} — ${emp.fullName}:`, err.message);
    }
  }

  console.log(`[repair-photos] Done. ${fixed} updated, ${failed} failed.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('[repair-photos] Failed:', err);
  process.exitCode = 1;
});

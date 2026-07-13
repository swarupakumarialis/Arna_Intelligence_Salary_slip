import * as googleDriveProvider from './googleDriveProvider.js';

/**
 * Cloud storage facade (Sprint 6.2A). Every caller in this app goes
 * through here rather than talking to a specific provider directly —
 * swapping Google Drive for S3/Cloudinary/Azure Blob/OneDrive later
 * means writing a new provider module with this same method shape
 * (connect/getAuthUrl/upload/delete/getFile/getStatus/disconnect) and
 * changing the one import below. Nothing in pdfStorage.service.js or
 * any controller needs to change.
 */
const activeProvider = googleDriveProvider;

export function getAuthUrl() {
  return activeProvider.getAuthUrl();
}

export async function connect(code) {
  return activeProvider.completeConnection(code);
}

export async function getStatus() {
  return activeProvider.getStatus();
}

export async function disconnect() {
  return activeProvider.disconnect();
}

export async function testConnection() {
  return activeProvider.testConnection();
}

export async function getStorageStats() {
  return activeProvider.getStorageStats();
}

/** Employee profile pictures (Production Hotfix) — a separate Drive
    folder from the salary-slip archive, uploaded/deleted through this
    same facade so a future storage-provider swap covers photos too
    with no change to employee.controller.js. */
export async function uploadEmployeePhoto({ buffer, employeeId, mimeType }) {
  return activeProvider.uploadEmployeePhoto({ buffer, employeeId, mimeType });
}

export async function upload({ buffer, fileName, year, month }) {
  return activeProvider.uploadFile({ buffer, fileName, year, month });
}

export async function deleteFile(fileId) {
  return activeProvider.delete(fileId);
}

export async function getFile(fileId) {
  return activeProvider.getFile(fileId);
}

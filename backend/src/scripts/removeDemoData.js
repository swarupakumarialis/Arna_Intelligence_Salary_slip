import 'dotenv/config';
import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import SalaryHistory from '../models/SalaryHistory.js';
import Invoice from '../models/Invoice.js';
import { DEMO_SOURCE } from './demoSource.js';

/**
 * Removes ONLY the demo data created by seedDemoData.js (Sprint 9 —
 * Gemini integration + safe demo data, Part 12).
 *
 * SAFETY: every deleteMany() below is scoped to { source: DEMO_SOURCE }
 * — never a bare/broad deleteMany({}) that could touch real company
 * data. A record only ever gets this `source` value from
 * seedDemoData.js; nothing else in the app sets it, so this filter can
 * never match anything a real user created.
 *
 * Usage:
 *   cd backend
 *   npm run remove:demo
 */
async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[remove:demo] MONGODB_URI is not set — configure backend/.env before running.');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri);
  console.log('[remove:demo] Connected to MongoDB.');

  const filter = { source: DEMO_SOURCE };
  const [employees, salaryHistory, invoices] = await Promise.all([
    Employee.deleteMany(filter),
    SalaryHistory.deleteMany(filter),
    Invoice.deleteMany(filter),
  ]);

  console.log(
    `[remove:demo] Removed ${employees.deletedCount} employee(s), ${salaryHistory.deletedCount} salary record(s), ` +
    `${invoices.deletedCount} invoice(s) tagged source="${DEMO_SOURCE}".`
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('[remove:demo] Failed:', err.message);
  process.exitCode = 1;
});

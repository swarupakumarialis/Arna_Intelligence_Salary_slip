import 'dotenv/config';
import mongoose from 'mongoose';
import Employee from '../models/Employee.js';

/**
 * One-time migration script: seeds/updates MongoDB with the ARNA team
 * roster that used to live in the frontend's localStorage-era bootstrap
 * files — src/data/arnaTeamSeed.ts and src/data/arnaEmployeeEnrichment.ts.
 *
 * ARNA_TEAM_SEED and ARNA_EMPLOYEE_ENRICHMENT below are a direct, by-hand
 * transcription of those two files (inspected as of this sprint). They
 * are NOT imported at runtime — this is a backend Node/ESM script and
 * those files are frontend TypeScript in a separate project, so
 * importing them directly isn't possible without pulling a TS loader
 * into the backend, which would be an architecture change outside this
 * sprint's scope. The two source files are left completely untouched
 * and now serve only as backup/reference.
 *
 * mergeSeedWithEnrichment() below reproduces exactly what
 * utils/employeeStore.ts's applyEmployeeEnrichment() used to do: each
 * enrichment patch is shallow-merged on top of its matching base seed
 * record, keyed by employeeId. toEmployeeDocument() then reproduces
 * frontend/src/api/employeeApi.ts's toApiPayload() mapping, so a
 * record seeded here is byte-for-byte the same shape as one saved
 * through the Employee Directory UI.
 *
 * Idempotent by design: every write is an upsert keyed by employeeId
 * (findOneAndUpdate with upsert:true), so re-running this script never
 * creates duplicates, and it never touches any employee whose
 * employeeId isn't in this list (existing unrelated records — e.g.
 * ones added by hand through the app — are left exactly as they are).
 *
 * Usage:
 *   cd backend
 *   node src/scripts/seedEmployees.js
 */

// ── Base seed — transcribed from src/data/arnaTeamSeed.ts ──────────
const ARNA_TEAM_SEED = [
  {
    employeeId: 'ARNA/INT001', name: 'Swarupa Kumari',
    email: 'swarupakumari062@gmail.com', phone: '8787413004',
    address: 'Village Baghauna, PO: Baghauna, Siwan, Bihar - 841210',
    department: '', designation: 'AI Systems & Operations Intern',
    employmentType: 'Intern', doj: '2026-03-09', status: 'Active',
  },
  {
    employeeId: 'ARNA/CONT001', name: 'Laxmi Arun',
    email: 'laxmiarun@alis-global.com', phone: '9449033576',
    address: '1468, 7th Cross, Krishnamurthypuram, Mysore',
    department: '', designation: 'Strategic Contributor',
    employmentType: 'Contract', doj: '2025-10-20', status: 'Active',
  },
  {
    employeeId: 'ARNA/CONT002', name: 'Debanka Maiti',
    email: 'debankamaiti1990@gmail.com', phone: '9130564451',
    address: 'A-301, Wisteria CHS, Manjari Road, Keshav Nagar, Mundhwa, Pune, Maharashtra - 411036',
    department: '', designation: 'Chief Operating Officer',
    employmentType: 'Contract', doj: '2026-02-01', status: 'Active',
  },
  {
    employeeId: 'ARNA/CONT003', name: 'Niharika Sarkar',
    email: 'niharikaofficial.2023@gmail.com', phone: '07683001610',
    address: 'Amma Ashram Lane D-48, Naveli, Vasant Kunj, Delhi - 110070',
    department: '', designation: 'Strategic Contributor',
    employmentType: 'Contract', doj: '2026-04-03', status: 'Active',
  },
  {
    employeeId: 'ARNA/CONT004', name: 'Sunitha Vaidya',
    email: 'sunithavaidya@alis-global.com',
    department: '', designation: '',
    employmentType: 'Contract', doj: '', status: 'Active',
  },
  {
    employeeId: 'ARNA/CONT005', name: 'Sushma Karnati',
    email: 'sushmakarnati14@gmail.com', phone: '9182002801',
    address: 'Hayathnagar, Hyderabad',
    department: '', designation: 'AI-Native Full-Stack & Middleware Engineer',
    employmentType: 'Contract', doj: '2026-06-09', status: 'Active',
  },
  {
    employeeId: 'ARNA/CONT007', name: 'Shashank Sekhar',
    email: 'shashank.shekhar2k17@gmail.com', phone: '9956820045',
    address: '18 Satya Puram Colony, Balaganj, Lucknow, Uttar Pradesh - 226003',
    department: '', designation: 'Fullstack Engineer',
    employmentType: 'Contract', doj: '2026-06-22', status: 'Active',
  },
  {
    employeeId: 'ARNA/CONT008', name: 'Rohit Throat',
    email: 'thoratrohit25@gmail.com', phone: '9082873256',
    address: 'Flat No. 808, Siddhivinayak Society, Siddharth Nagar, Kopri Colony, Thane East, Maharashtra',
    department: '', designation: 'Strategic Contributor',
    employmentType: 'Contract', doj: '2000-10-25', status: 'Active',
  },
];

// ── Enrichment patch — transcribed from src/data/arnaEmployeeEnrichment.ts
// Deliberately excludes ARNA/CONT006 (Ritek Sharma) and any "Ayush
// Verma" record, exactly as the source file does — neither is part of
// the ARNA Team Directory (explicit instruction from an earlier sprint).
const ARNA_EMPLOYEE_ENRICHMENT = {
  'ARNA/INT001': {
    email: 'swarupakumari062@gmail.com', phone: '8787413004',
    address: 'Village Baghauna, PO: Baghauna, Siwan, Bihar - 841210',
    designation: 'AI Systems & Operations Intern', doj: '2026-03-09',
  },
  'ARNA/CONT001': {
    email: 'laxmiarun@alis-global.com', phone: '9449033576',
    address: '1468, 7th Cross, Krishnamurthypuram, Mysore',
    designation: 'Strategic Contributor', doj: '2025-10-20',
  },
  'ARNA/CONT002': {
    email: 'debankamaiti1990@gmail.com', phone: '9130564451',
    address: 'A-301, Wisteria CHS, Manjari Road, Keshav Nagar, Mundhwa, Pune, Maharashtra - 411036',
    designation: 'Chief Operating Officer', doj: '2026-02-01',
  },
  'ARNA/CONT003': {
    email: 'niharikaofficial.2023@gmail.com', phone: '07683001610',
    address: 'Amma Ashram Lane D-48, Naveli, Vasant Kunj, Delhi - 110070',
    designation: 'Strategic Contributor', doj: '2026-04-03',
  },
  'ARNA/CONT005': {
    email: 'sushmakarnati14@gmail.com', phone: '9182002801',
    address: 'Hayathnagar, Hyderabad',
    designation: 'AI-Native Full-Stack & Middleware Engineer', doj: '2026-06-09',
  },
  'ARNA/CONT007': {
    email: 'shashank.shekhar2k17@gmail.com', phone: '9956820045',
    address: '18 Satya Puram Colony, Balaganj, Lucknow, Uttar Pradesh - 226003',
    designation: 'Fullstack Engineer', doj: '2026-06-22',
  },
  'ARNA/CONT008': {
    email: 'thoratrohit25@gmail.com', phone: '9082873256',
    address: 'Flat No. 808, Siddhivinayak Society, Siddharth Nagar, Kopri Colony, Thane East, Maharashtra',
    designation: 'Strategic Contributor', doj: '2000-10-25',
  },
};

/** Same shallow-merge applyEmployeeEnrichment() used: enrichment
    fields win over the base seed's, keyed by employeeId. Employees
    with no matching patch (ARNA/CONT004) pass through unchanged. */
function mergeSeedWithEnrichment(seed, enrichment) {
  return seed.map(emp => ({ ...emp, ...(enrichment[emp.employeeId] || {}) }));
}

/** Frontend Employee shape → backend Employee schema shape. Mirrors
    frontend/src/api/employeeApi.ts's toApiPayload() field-for-field. */
function toEmployeeDocument(emp) {
  return {
    employeeId: emp.employeeId,
    fullName: emp.name,
    email: emp.email || undefined,
    phone: emp.phone || '',
    address: emp.address || '',
    department: emp.department || '',
    designation: emp.designation || '',
    employmentType: emp.employmentType || null,
    dateOfJoining: emp.doj || '',
    status: emp.status || 'Active',
    bankDetails: {
      bankName: emp.bankName || '',
      accountNumber: emp.bankAccount || '',
      ifsc: emp.ifsc || '',
      branch: emp.branch || '',
    },
    PAN: emp.pan || '',
    Aadhaar: emp.aadhaar || '',
    salaryDetails: emp.salaryStructureNote || '',
    photoDataUri: emp.photoDataUri ?? null,
    uan: emp.uan || '',
    manager: emp.manager || '',
    emergencyContact: emp.emergencyContact || '',
    employmentEndDate: emp.employmentEndDate || '',
    notes: emp.notes || '',
  };
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[seed] MONGODB_URI is not set. This script reads it from the environment the same way server.js does — configure backend/.env (not modified by this script) before running.');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri);
  console.log('[seed] Connected to MongoDB.');

  const merged = mergeSeedWithEnrichment(ARNA_TEAM_SEED, ARNA_EMPLOYEE_ENRICHMENT);

  let created = 0;
  let updated = 0;

  for (const emp of merged) {
    const doc = toEmployeeDocument(emp);
    const existing = await Employee.findOne({ employeeId: doc.employeeId }).select('_id').lean();

    await Employee.findOneAndUpdate(
      { employeeId: doc.employeeId },
      { $set: doc },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    if (existing) {
      updated += 1;
      console.log(`[seed] Updated ${doc.employeeId} — ${doc.fullName}`);
    } else {
      created += 1;
      console.log(`[seed] Created ${doc.employeeId} — ${doc.fullName}`);
    }
  }

  console.log(`[seed] Done. ${created} created, ${updated} updated, ${merged.length} total ARNA employees processed.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('[seed] Failed:', err);
  process.exitCode = 1;
});

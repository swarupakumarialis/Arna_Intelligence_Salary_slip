import mongoose from 'mongoose';

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern'];
const STATUSES = ['Active', 'Inactive'];

/** Embedded, not a separate collection — bank details only ever exist
    in the context of one employee and are always read/written together. */
const bankDetailsSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    ifsc: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

/**
 * Employee Directory schema. Field names match Sprint 5.2's spec
 * exactly (employeeId, fullName, email, phone, address, designation,
 * department, employmentType, dateOfJoining, status, bankDetails,
 * PAN, Aadhaar, salaryDetails) plus a few additional fields
 * (photoDataUri, uan, manager, emergencyContact, employmentEndDate,
 * notes) that the existing Employee Directory UI already has form
 * fields for — omitting them would silently drop data the frontend
 * still collects, which "no breaking changes" rules out. See
 * frontend/src/api/employeeApi.ts for the mapping onto the frontend's
 * existing Employee TypeScript shape.
 *
 * email is unique-but-optional: a plain unique index would reject a
 * second employee saved with no email (multiple docs with `email: ""`
 * collide), which the frontend currently allows. `sparse: true` makes
 * the index skip documents where the field isn't set at all; the
 * service layer (services/employee.service.js) deletes the key
 * entirely from the payload when the incoming email is blank, rather
 * than storing an empty string, so sparse actually applies.
 */
const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    employmentType: { type: String, enum: [...EMPLOYMENT_TYPES, null], default: null },
    dateOfJoining: { type: String, trim: true, default: '' },
    status: { type: String, enum: STATUSES, default: 'Active' },
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },
    PAN: { type: String, trim: true, default: '' },
    Aadhaar: { type: String, trim: true, default: '' },
    salaryDetails: { type: String, trim: true, default: '' },

    // Extended fields — see file-level comment.
    photoDataUri: { type: String, default: null },
    uan: { type: String, trim: true, default: '' },
    manager: { type: String, trim: true, default: '' },
    emergencyContact: { type: String, trim: true, default: '' },
    employmentEndDate: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Employee', employeeSchema);

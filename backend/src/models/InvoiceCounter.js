import mongoose from 'mongoose';

/**
 * Backs sequential invoice numbering (INV-<year>-0001). One document
 * per year; `seq` is incremented atomically via findByIdAndUpdate's
 * $inc, which MongoDB guarantees is race-safe under concurrent writes
 * — unlike scanning for the current max invoiceNumber and adding 1,
 * which can produce duplicates under concurrent requests. No existing
 * counter-collection pattern exists elsewhere in this backend
 * (Employee/SalaryHistory ids are either user-supplied or Mongo
 * ObjectIds); this is a new pattern introduced specifically for
 * Invoice numbering (Sprint 4).
 */
const invoiceCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // the year, e.g. "2026"
    seq: { type: Number, required: true, default: 0 },
  },
  { versionKey: false }
);

export default mongoose.model('InvoiceCounter', invoiceCounterSchema);

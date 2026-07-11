import mongoose from 'mongoose';

/* Fail fast instead of silently queueing: by default Mongoose queues
   ("buffers") queries issued while disconnected and waits up to
   bufferTimeoutMS (10s) before rejecting them. With no DB connected —
   MONGODB_URI unset, Atlas unreachable, etc. — that turns every API
   call into a 10-second hang before the client finally sees an error.
   Disabling buffering makes those calls reject immediately, which is
   what lets the frontend's "Unable to connect to server" toast (see
   frontend/src/api/employeeApi.ts) show up promptly instead of after
   a long stall. */
mongoose.set('bufferCommands', false);

/**
 * MongoDB connection, via Mongoose. The URI always comes from
 * process.env.MONGODB_URI (see .env.example) — never hardcoded here,
 * so the same code runs against a local MongoDB instance, MongoDB
 * Atlas, or any other environment purely by changing .env.
 *
 * Deliberately does not throw or exit the process on failure: the
 * HTTP server should still come up and respond (see GET /api/health,
 * which reports the live connection state) even if MONGODB_URI is
 * unset or unreachable — routes that actually need the database will
 * fail on their own (fast, per bufferCommands above) rather than the
 * whole process refusing to start.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('[database] MONGODB_URI is not set — skipping MongoDB connection. Set it in .env to enable the database.');
    return;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('[database] MongoDB connected');
  } catch (error) {
    console.error('[database] MongoDB connection failed:', error.message);
  }
}

/** True once Mongoose has an active connection — used by the health endpoint. */
export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

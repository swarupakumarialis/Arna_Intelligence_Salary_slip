import mongoose from 'mongoose';

/**
 * MongoDB connection, via Mongoose. The URI always comes from
 * process.env.MONGODB_URI (see .env.example) — never hardcoded here,
 * so the same code runs against a local MongoDB instance, MongoDB
 * Atlas, or any other environment purely by changing .env.
 *
 * Deliberately does not throw or exit the process on failure: this
 * foundation sprint has no models or routes that depend on the
 * database yet, so the HTTP server should still come up and respond
 * (see GET /api/health, which reports the live connection state)
 * even if MONGODB_URI is unset or unreachable. Once real data routes
 * exist, callers that need a guaranteed connection can check
 * mongoose.connection.readyState themselves.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.warn('[database] MONGODB_URI is not set — skipping MongoDB connection. Set it in .env to enable the database.');
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('[database] MongoDB connected');
  } catch (error) {
    console.error('[database] MongoDB connection failed:', error.message);
  }
}

/** True once Mongoose has an active connection — used by the health endpoint. */
export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

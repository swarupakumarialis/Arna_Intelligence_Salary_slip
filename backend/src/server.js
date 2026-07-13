import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/database.js';
import { verifyEmailTransporter } from './services/email.service.js';

const PORT = process.env.PORT || 5000;

/**
 * Entry point — loads .env, attempts the MongoDB connection, then
 * starts listening regardless of whether that connection succeeded
 * (see config/database.js for why). Kept separate from app.js so
 * "configure the app" and "start the process" are two distinct,
 * independently testable concerns.
 */
async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[server] ARNA Salary Suite API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  // Best-effort, non-blocking (Production Hotfix): logs whether SMTP
  // is actually reachable from wherever this process is running,
  // right in the boot logs — on Render this is the fastest way to
  // confirm the deployed transporter config without waiting for a
  // real "Email Employee" click. Never delays or fails startup.
  verifyEmailTransporter().catch(() => {});
}

start();

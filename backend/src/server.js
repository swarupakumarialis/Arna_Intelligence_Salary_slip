import 'dotenv/config';
import app from './app.js';
import { connectDB } from './config/database.js';

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
}

start();

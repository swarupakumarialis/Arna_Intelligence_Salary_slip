import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { isDatabaseConnected, getDatabaseName } from './config/database.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import employeeRoutes from './routes/employee.routes.js';
import salaryHistoryRoutes from './routes/salaryHistory.routes.js';
import pdfStorageRoutes from './routes/pdfStorage.routes.js';
import emailRoutes from './routes/email.routes.js';
import googleDriveRoutes from './routes/googleDrive.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import aiRoutes from './routes/ai.routes.js';
import Employee from './models/Employee.js';
import Invoice from './models/Invoice.js';
import SalaryHistory from './models/SalaryHistory.js';
import { DEMO_SOURCE } from './scripts/demoSource.js';

/**
 * Express app configuration — separated from server.js (which owns
 * starting the HTTP listener and connecting to MongoDB) so the app
 * itself can be imported and tested in isolation later without
 * booting a real server or database connection.
 */
const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * GET / — top-level health/identity check. Confirms the API itself is
 * reachable and identifies what's running, independent of the database.
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    application: 'ARNA Salary Suite API',
    version: '1.0.0',
  });
});

/**
 * GET /api/health — deeper health check, reports live MongoDB
 * connection state alongside server status. This is the endpoint a
 * deploy/monitoring tool (or the frontend, later) would poll.
 *
 * Sprint 9.1, Part 7 — also the safe way to confirm "which database is
 * this deployment actually talking to" (e.g. is Render's backend on
 * the same MongoDB as local dev) WITHOUT ever exposing credentials:
 * only the database's bare name (getDatabaseName() — see database.js's
 * comment on exactly what it does and doesn't read off the connection)
 * and plain record counts, never the connection string, host, username,
 * or password. Counts are wrapped in their own try/catch so a query
 * failure degrades to `null` counts rather than turning a genuinely
 * healthy "server is up" response into a failure.
 */
app.get('/api/health', async (req, res) => {
  const connected = isDatabaseConnected();
  const payload = {
    server: 'running',
    environment: process.env.NODE_ENV || 'development',
    mongodb: {
      connected,
      databaseName: connected ? getDatabaseName() : null,
    },
    // Legacy field, kept for any existing caller of this endpoint.
    database: connected ? 'connected' : 'disconnected',
  };

  if (connected) {
    try {
      const [employees, employeesDemo, invoices, invoicesDemo, salaryHistory, salaryHistoryDemo] = await Promise.all([
        Employee.countDocuments(),
        Employee.countDocuments({ source: DEMO_SOURCE }),
        Invoice.countDocuments(),
        Invoice.countDocuments({ source: DEMO_SOURCE }),
        SalaryHistory.countDocuments(),
        SalaryHistory.countDocuments({ source: DEMO_SOURCE }),
      ]);
      payload.data = {
        employees, employeesDemo,
        invoices, invoicesDemo,
        salaryHistory, salaryHistoryDemo,
      };
    } catch {
      payload.data = null;
    }
  }

  res.json(payload);
});

app.use('/api/employees', employeeRoutes);
app.use('/api/salary-history', salaryHistoryRoutes);
app.use('/api/pdf', pdfStorageRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/integrations/google-drive', googleDriveRoutes);
/* Sprint 4 — Invoice module (Finance section). A completely independent
   collection/route from Employee/SalaryHistory; see models/Invoice.js. */
app.use('/api/invoices', invoiceRoutes);
/* Sprint 8 — AI Assistant (Version 1, read-only). See services/ai.service.js
   for the intent-detection → existing-service → structured-JSON → AI-
   formats-response pipeline this route triggers. */
app.use('/api/ai', aiRoutes);

// Future feature routers (auth, …) mount here, above notFound/errorHandler.

app.use(notFound);
app.use(errorHandler);

export default app;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { isDatabaseConnected } from './config/database.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import employeeRoutes from './routes/employee.routes.js';
import salaryHistoryRoutes from './routes/salaryHistory.routes.js';
import pdfStorageRoutes from './routes/pdfStorage.routes.js';
import emailRoutes from './routes/email.routes.js';
import googleDriveRoutes from './routes/googleDrive.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import aiRoutes from './routes/ai.routes.js';

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
 */
app.get('/api/health', (req, res) => {
  res.json({
    database: isDatabaseConnected() ? 'connected' : 'disconnected',
    server: 'running',
  });
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

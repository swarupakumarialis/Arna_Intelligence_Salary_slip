# ARNA Salary Suite — Backend

Node.js + Express + MongoDB (Mongoose) API for ARNA Salary Suite.

Sprint 5.1 laid the foundation (Express configured, MongoDB connects
via Mongoose, health-check endpoints). Sprint 5.2 added the first real
feature, following MVC: the **Employee Directory** — full CRUD +
search, backed by MongoDB, following Routes → Controller → Service →
Model. No other feature (auth, salary generation, email, PDF storage)
exists yet; those land in later sprints on this same pattern.

## Folder Structure

```
backend/
├── src/
│   ├── config/            # App-level configuration (database.js — Mongoose connection)
│   ├── controllers/       # HTTP layer: parses requests, calls services, shapes responses
│   │   └── employee.controller.js
│   ├── middleware/         # Express middleware (404 + centralised error handler)
│   │   └── errorHandler.js
│   ├── models/             # Mongoose schemas
│   │   └── Employee.js
│   ├── routes/             # Route → controller wiring, one file per feature
│   │   └── employee.routes.js
│   ├── services/           # Business logic — queries, validation, duplicate checks, errors
│   │   └── employee.service.js
│   ├── utils/               # Shared helpers
│   │   ├── AppError.js       # Error class carrying an HTTP status code
│   │   └── asyncHandler.js   # Wraps async route handlers so thrown errors reach next(err)
│   ├── app.js               # Express app: middleware, health routes, feature routers — no listener
│   └── server.js            # Entry point: loads .env, connects to MongoDB, starts the HTTP server
├── uploads/                  # Runtime file uploads (gitignored; folder tracked via .gitkeep)
├── generated-pdfs/           # Runtime-generated PDFs (gitignored; folder tracked via .gitkeep)
├── package.json
├── .gitignore
├── .env.example
└── README.md
```

`app.js` and `server.js` are deliberately separate: `app.js` only
configures the Express app (middleware, routes) and exports it —
nothing here starts a server or touches the network. `server.js` is
the only file that loads environment variables, connects to MongoDB,
and calls `app.listen()`. This means `app.js` can be imported by a
test suite later without ever binding a port or requiring a real
database.

## Running Locally

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values, at least PORT
npm run dev            # nodemon — restarts on file changes
# or
npm start               # plain node, for production
```

The server starts and responds even if `MONGODB_URI` is left empty —
`GET /api/health` will simply report `"database": "disconnected"`, and
any route that touches the database (all of `/api/employees`) will
fail fast with a clear JSON error instead of hanging or crashing the
process (see `mongoose.set('bufferCommands', false)` in
`config/database.js`).

`FRONTEND_URL` must match the frontend's actual dev server origin for
CORS to allow it through — this project's frontend runs on
`http://localhost:3000` (see the root `package.json`'s `dev` script),
not Vite's default `5173` used as the placeholder in `.env.example`.

## Environment Variables

Copy `.env.example` to `.env` and fill in real values:

| Variable       | Purpose                                                                 |
|----------------|--------------------------------------------------------------------------|
| `PORT`         | Port the Express server listens on (default `5000`).                    |
| `NODE_ENV`     | `development` or `production` — affects logging format (morgan).        |
| `MONGODB_URI`  | MongoDB connection string (local or Atlas). Never hardcoded in code.    |
| `JWT_SECRET`   | Reserved for the authentication sprint — not used yet.                  |
| `EMAIL_USER`   | Reserved for the email-sending sprint — not used yet.                   |
| `EMAIL_PASS`   | Reserved for the email-sending sprint — not used yet.                   |
| `FRONTEND_URL` | Origin allowed by CORS — must match where the React app is served from. |

`.env` is gitignored; only `.env.example` (with blank/placeholder
values) is committed.

## Endpoints (current)

| Method | Path                     | Purpose                                                        |
|--------|--------------------------|------------------------------------------------------------------|
| GET    | `/`                      | API identity check — confirms the server is running.            |
| GET    | `/api/health`            | Server + live MongoDB connection status.                        |
| GET    | `/api/employees`         | List employees. Query: `?page=&limit=` (defaults 1 / 50).       |
| GET    | `/api/employees/search`  | Search by name, employee ID, or email. Query: `?q=&page=&limit=` |
| GET    | `/api/employees/:id`     | Fetch one employee by MongoDB `_id`.                             |
| POST   | `/api/employees`         | Create an employee.                                              |
| PUT    | `/api/employees/:id`     | Update an employee.                                              |
| DELETE | `/api/employees/:id`     | Delete an employee.                                              |

Every response uses the same envelope:

```json
{ "success": true, "message": "Employees fetched successfully", "data": { "...": "..." } }
```

Errors use the same shape with `success: false` and `data: null`, and
a matching HTTP status — `400` (invalid input / bad id), `404` (not
found), `409` (duplicate `employeeId` or `email`), `500` (unexpected).

## Tech Stack

- **Express** — HTTP server and routing.
- **Mongoose** — MongoDB object modelling (connection configured; no schemas yet).
- **dotenv** — loads `.env` into `process.env`.
- **cors** — restricts API access to the configured `FRONTEND_URL`.
- **helmet** — sets standard security-related HTTP headers.
- **morgan** — HTTP request logging.
- **nodemon** — auto-restarts the server on file changes (dev only).

ES Modules (`import`/`export`) are used throughout, matching the
frontend's `"type": "module"` convention.

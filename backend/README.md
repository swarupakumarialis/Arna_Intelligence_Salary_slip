# ARNA Salary Suite — Backend

Node.js + Express + MongoDB (Mongoose) API for ARNA Salary Suite.

This is currently a **foundation only** — Express is configured, MongoDB
connects via Mongoose, and two health-check endpoints exist. There are
no models, controllers, CRUD routes, or authentication yet; those land
in later sprints on top of this scaffold.

## Folder Structure

```
backend/
├── src/
│   ├── config/          # App-level configuration (e.g. database.js — Mongoose connection)
│   ├── controllers/     # (empty — route handler logic, added when real features land)
│   ├── middleware/       # Express middleware (currently: 404 + error handler)
│   ├── models/           # (empty — Mongoose schemas, added when real features land)
│   ├── routes/           # (empty — feature routers, added when real features land)
│   ├── services/         # (empty — business logic / integrations, e.g. email, PDF)
│   ├── utils/             # (empty — shared helpers)
│   ├── app.js             # Express app: middleware, health routes, error handling — no listener
│   └── server.js          # Entry point: loads .env, connects to MongoDB, starts the HTTP server
├── uploads/                # Runtime file uploads (gitignored; folder tracked via .gitkeep)
├── generated-pdfs/         # Runtime-generated PDFs (gitignored; folder tracked via .gitkeep)
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
`GET /api/health` will simply report `"database": "disconnected"`
until a real connection string is provided. This is intentional for
this sprint: no route yet depends on the database being up.

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

| Method | Path           | Purpose                                              |
|--------|----------------|-------------------------------------------------------|
| GET    | `/`            | API identity check — confirms the server is running. |
| GET    | `/api/health`  | Server + live MongoDB connection status.              |

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

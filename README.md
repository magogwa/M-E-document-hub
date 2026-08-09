# M&E Document Hub

A production-ready, secure document management system for Monitoring & Evaluation work. Admins upload, organize and
share documents with clients; clients access only what has been shared with them. Built with React / TypeScript /
Tailwind (frontend), Node.js / Express (backend API), and Supabase (PostgreSQL + Auth + private Storage Buckets),
fully deployable online for use on any device.

## Why an API server in front of Supabase?

All access control is enforced **server-side** through the Express API (single JWT signing service, server-owned
tokens, signed short-lived download URLs, full activity audit trail). The frontend never talks to Supabase directly,
so bucket keys and the service-role key are never exposed to browsers.

## Architecture

```
Browser (React SPA)
   │  /api/*  (JWT bearer token in Authorization header)
   ▼
Express API (server/)  ──►  Supabase (PostgreSQL via service-role key)
   │
   ├─ Auth: register / login / refresh / logout / forgot / reset / change-password
   ├─ Documents: upload (Multer in-memory + magic-byte validation), list/search/filter,
   │              detail, edit, delete, versions, download, preview (signed URLs)
   ├─ Clients: CRUD + activate/block (pending → active)
   ├─ Access: grant / revoke document access per client
   ├─ Categories: CRUD
   ├─ Activity log: upload, download, preview, share, login, failed login, ...
   ├─ Dashboard: totals, 6-month upload trend, recent uploads/activity (admin + client)
   └─ Settings: runtime configuration stored in DB
```

- **Private storage bucket** `documents` — files never public; access via signed URLs (15 min TTL).
- **Versioning** — every replacement upload creates a `document_versions` row (`version` increments).
- **RBAC** — roles `admin` / `client`; access via `document_access` join table checked by triggers and the API.
- **RLS** — Row Level Security enabled on all tables (the API uses the service role; RLS protects direct access).
- **Storage guard** — configurable storage limit; uploads rejected above limit.
- **Magic-byte validation** — file type checked by content (not just extension).

## Repo layout

```
me-document-hub/
├── server/            Express API (TypeScript, ESM)
│   ├── src/
│   │   ├── config/env.ts        zod-validated environment
│   │   ├── libs/                supabase client, errors, logger, pagination
│   │   ├── middlewares/         auth (JWT), role guards, file validation
│   │   ├── services/            activity, email, access, storage, settings, clients
│   │   └── routes/              api router + controllers
│   ├── tests/          Vitest suite (auth, documents, access, clients, categories, settings)
│   └── ...           (backend code lives in server/src)
├── render.yaml      Render.com blueprint (root-level, service rootDir=server)
├── client/            React 18 + Vite 6 + Tailwind 3
│   ├── src/
│   │   ├── lib/        api client (token refresh), auth context, guards, format helpers
│   │   ├── components/ AppShell, DocumentsBrowser (shared admin/client), preview modal, UI kit
│   │   └── pages/      auth / admin / client pages
│   └── vercel.json     SPA rewrite
└── supabase/
    └── migrations/0001_init.sql   Schema + indexes + RLS + triggers
```

## Getting started

Prerequisites: **Node.js ≥ 20** (developed on 24.x) and a **Supabase project**.

### 1. Database

1. Create a project in [Supabase](https://supabase.com).
2. Open **SQL Editor**, paste the content of `supabase/migrations/0001_init.sql` and run.
3. The API creates/verifies the private `documents` bucket automatically on startup
   (override the name via the `BUCKET_NAME` env var if you prefer).
5. Take note of: Project URL, `service_role` key. The `service_role` key lives in
   **Settings → API → service_role (secret)**. Keep it secret — it bypasses RLS.

### 2. Backend

```bash
cd server
cp .env.example .env   # fill in the values (or set env vars in production)
npm install
npm run typecheck
npm test               # 19 unit tests
npm run dev            # http://localhost:4000
```

`.env` variables:

| Variable            | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `PORT`              | API port (default `4000`)                                  |
| `SUPABASE_URL`      | Project URL, e.g. `https://xxxx.supabase.co`               |
| `SUPABASE_SERVICE_ROLE_KEY` | Project `service_role` key                         |
| `JWT_SECRET`        | Long random string used to sign your own access tokens     |
| `TOKEN_TTL`         | Optional access-token lifetime (default `8h`)              |
| `APP_URL`           | Public web app origin (used for CORS + password reset link)|
| `EMAIL_API_KEY`     | Optional – API key for password-reset/notification emails  |

### 3. Frontend

```bash
cd client
npm install
npm run dev            # http://localhost:5173 (proxies /api to :4000)
npm run typecheck
npm run build          # outputs dist/
```

Optional env: `VITE_API_URL` — when the SPA is hosted elsewhere than `/api` of the same origin
(e.g. a separate API domain). Defaults to `/api`.

### 4. First admin

After starting the API once, call the setup endpoint (no auth needed, only works while no
admin exists):

```bash
curl -X POST http://localhost:4000/api/auth/setup-admin \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Full Name","email":"admin@example.com","password":"long-secure-password"}'
```

If anything interferes, an admin can also be created directly in the database
(`auth.users` via Auth → Users) and then setting role manually — the setup endpoint is the
supported path.

## API overview (all under `/api`)

| Route                                              | Purpose                                    |
| --------------------------------------------------- | ------------------------------------------ |
| `POST /auth/register`                             | client self-registration (gated)           |
| `POST /auth/login` / `POST /auth/refresh` / `POST /auth/logout` | session management          |
| `POST /auth/setup-admin`                          | create the very first admin (once)         |
| `POST /auth/forgot-password` / `POST /auth/reset-password` | password reset via email token |
| `POST /auth/change-password`                      | change own password                   |
| `GET /auth/me`                                    | current profile                            |
| `POST /documents/upload`                          | multipart upload (file + metadata)         |
| `GET /documents`                                  | admin: all | client: only shared (paged)   |
| `GET /documents/:id`                              | detail incl. versions + access             |
| `PATCH /documents/:id`  `DELETE /documents/:id`  | edit / delete (admin)                |
| `POST /documents/:id/versions`                    | upload a new version (admin)               |
| `GET /documents/:id/download` / `.../download/:versionId`  | signed download URLs      |
| `GET /documents/:id/preview`                      | signed preview URL (inline)                |
| `GET/POST/PATCH/DELETE /categories`               | category CRUD (admin writes)               |
| `GET/POST/PATCH/DELETE /clients`                  | client CRUD + status (admin)               |
| `POST /access`  `POST /access/revoke`             | grant / revoke document access             |
| `GET /access`                                     | access grants with search (admin)          |
| `GET /activity/logs`                              | paginated activity trail (admin)           |
| `GET /dashboard/admin` / `GET /dashboard/client`  | dashboards                             |
| `GET/PUT /settings`                               | runtime settings (admin)                   |
| `GET /health`                                     | health check (no auth)                     |

## Deploying

### Backend — Render

`render.yaml` (repo root) defines a Node web service (`render deploy blueprint render.yaml`).
Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `APP_URL`, `EMAIL_API_KEY` in
the Render dashboard. Remember to hit `/api/auth/setup-admin` once after first deploy.

### Frontend — Vercel

Import the repo (root `client/` as framework preset "Vite") — `client/vercel.json` already
provides the SPA rewrite. Set `VITE_API_URL` in build if Vercel may not proxy `/api` — if you
run the API on Render, set `VITE_API_URL` to e.g. `https://your-api.onrender.com`.

## Security notes

- Multer holds uploads in memory; files are never written to disk (works everywhere).
- File content is verified via magic bytes before anything is persisted.
- All downloads go through signed URLs (15 minutes) — never public bucket URLs.
- Passwords are hashed with bcrypt; JWTs are signed with an app-side secret.
- Activity is logged for login, upload, download, preview, share/revoke, and admin actions.
- `settings.allowClientRegistration` and `emailNotifications` gate client-self-sign-up
  and notification emails.

## Testing

- `server`: `npm test` (Vitest — 19 tests covering auth, documents, upload validation,
  access rules, categories, clients, settings).
- `client`: `npm run typecheck` — full compile check (builds `dist/` with `npm run build`).

## Licenses

Everything under project scope is free to use internally; icons via `lucide-react`, styling
via Tailwind CSS, package licenses apply as-is.
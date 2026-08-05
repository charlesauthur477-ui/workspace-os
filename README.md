# Workspace OS

Self-hosted personal dashboard. Plugin-based app system — apps, RDPs, and
internal servers are database-driven, not hardcoded. See
`workspace-os-proposal.md` (one level up) for the full architecture writeup.

This is a **Phase 1 + 2 scaffold**: auth (Google OAuth + pending-approval),
RBAC, the App System core (definitions/instances/dashboard grid), RDP
one-time-token handoff for the local Connector, audit logging, and CPU/RAM
metrics. It is a real starting codebase, not a mockup — but it still needs
the Windows Connector app (§6 of the proposal) built separately, and the
admin UI pages (`/admin/users`, `/admin/apps`) are stubbed as empty routes
for you to fill in next.

## Structure

```
apps/web    Next.js dashboard (frontend)
apps/api    Express API (backend, Prisma/PostgreSQL)
packages/shared-types   Types shared by both apps
```

## Local development

```bash
npm install
cp .env.example .env      # fill in real values, see below
npm run prisma:migrate -w apps/api   # requires a running Postgres — see docker-compose
npx prisma db seed --schema apps/api/prisma/schema.prisma
npm run dev:api            # http://localhost:4000
npm run dev:web             # http://localhost:3000
```

Or just run everything via Docker Compose locally:

```bash
docker compose up --build
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — create an OAuth 2.0 Client ID
  (Web application) in Google Cloud Console. Authorized redirect URI must
  match `GOOGLE_CALLBACK_URL` exactly (e.g. `https://api.yourdomain.com/auth/google/callback`).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — any long random strings, e.g.
  `openssl rand -base64 48`.
- `MASTER_ENCRYPTION_KEY` — `openssl rand -base64 32`. This encrypts every
  stored credential (RDP passwords, etc). Losing it makes stored credentials
  unrecoverable — back it up somewhere safe outside the VPS.
- `OWNER_EMAIL` — the Gmail address that should automatically become Owner
  on first sign-in. Set this to yours before first deploy.

## Deploying with Coolify

1. Push this repo to GitHub/GitLab (Coolify deploys from a git remote).
2. In Coolify: **New Resource → Docker Compose**, point it at this repo/branch.
   Coolify will detect `docker-compose.yaml` at the root and its three
   services (`postgres`, `api`, `web`). If you already created the resource
   as a plain Dockerfile/Application, go to Configuration → General and
   change **Build Pack** to `Docker Compose`, with **Docker Compose Location**
   set to exactly `/docker-compose.yaml`, then click **Load Compose File**
   before saving.
3. In the resource's **Environment Variables** tab, set every variable from
   `.env.example` (Coolify injects these into the compose build/run — do not
   commit a real `.env` file to git).
4. Assign domains: in the service settings, give `web` something like
   `dashboard.yourdomain.com` and `api` something like `api.yourdomain.com`.
   Coolify provisions Let's Encrypt TLS automatically for both — no manual
   Nginx config needed.
5. Update `GOOGLE_CALLBACK_URL`, `APP_URL`, and `NEXT_PUBLIC_API_URL` env
   vars to use those real domains, then redeploy.
6. Deploy. Coolify builds each Dockerfile, runs `postgres` first (health-checked),
   then `api` (which runs `prisma migrate deploy` + seed on boot), then `web`.
7. Visit `dashboard.yourdomain.com`, sign in with the `OWNER_EMAIL` Google
   account — you should land straight on the dashboard as Owner (no approval
   needed for that first account). Any other Google account that signs in
   afterward lands on `/pending-approval` until you approve them from the
   admin users page.

## What's next (not yet built)

- Admin UI pages for approving users, managing roles, adding App Definitions
  from the dashboard (`POST /apps/definitions` API already works — the forms
  calling it don't exist yet).
- The Workspace OS Connector (Windows) — the local app that registers
  `workspaceos-rdp://` and performs the native RDP/desktop-app launch
  described in the proposal §6. This is a separate small Electron or .NET
  project, not part of this web monorepo.
- Embedded-iframe panel route (`/apps/[id]`) with automatic X-Frame-Options
  detection and new-tab fallback.
- Redis-backed one-time-token store for RDP connect tokens (currently
  in-memory, fine for a single API instance, not for horizontal scaling).

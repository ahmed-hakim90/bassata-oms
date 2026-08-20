<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Velora is a single Next.js 16 app (POS + light ERP) backed by a **local Supabase stack** (Postgres + Auth + RLS + Storage) run via Docker. There is one product/service to run: the Next dev server (`npm run dev`, port 3000) plus Supabase. Standard scripts live in `package.json`/`README.md`; only the non-obvious caveats are below.

### Starting services (no systemd in this VM)
The update script only refreshes npm deps (`npm ci`). Docker + the Supabase CLI are already installed but nothing auto-starts, so start them manually each session:

1. Start the Docker daemon (systemd is unavailable):
   `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`
   The daemon is configured for `fuse-overlayfs` with `containerd-snapshotter=false` (required on this kernel — see `/etc/docker/daemon.json`); iptables is set to `iptables-legacy`.
2. Start Supabase: `supabase start` (API `54321`, DB `54322`, Studio `54323`). The DB container is `supabase_db_SweetFlow-pos`.
3. Start the app: `npm run dev` (http://localhost:3000).

The Supabase Docker volume persists DB state (migrations, seed, grants, auth users) across container restarts, so after a reboot you usually only need to restart the containers — not re-seed. Steps under "Post-`db reset`" below are only needed after a fresh init or `supabase db reset`.

### `.env.local` (gitignored — recreate if missing)
Required for the app + `db:seed-auth`. Use the standard local Supabase keys (get exact values from `supabase status`):
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`, `SUPABASE_SERVICE_ROLE_KEY=<service_role key>` (must be the JWT `service_role` key, not the `sb_secret_…` one — `seed-auth.mjs` validates the `role` claim), plus `VELORA_COOKIE_SECRET=<32+ char random>`. Optional: `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `PLATFORM_BOOTSTRAP_EMAILS=owner@CafeFlow.local` (unlocks `/platform`).

### Post-`db reset` / fresh-init caveat: DB grants (REQUIRED)
The local `supabase/postgres` image applies restricted default privileges: tables created by the `postgres` role during migrations grant only `TRUNCATE/REFERENCES/TRIGGER` (no DML) to `anon/authenticated/service_role`. As a result `npm run db:seed-auth` fails with `permission denied for table users`, and the app cannot read/write any data. After every `supabase db reset` (or the very first `supabase start`), re-apply the standard grants, then seed:
```
docker exec supabase_db_SweetFlow-pos psql -U postgres -d postgres -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;"
npm run db:seed-auth
```
Do not edit migrations/`seed.sql` for this — it is a local-image quirk (hosted Supabase grants these by default). Demo login: `owner@CafeFlow.local` / `demo1234` (see `docs/DEMO_USERS.md`).

### Lint caveat
`supabase start` writes a minified edge-runtime file under `supabase/.temp/start-secrets/**`. ESLint (flat config) lints it and reports ~154 false `prefer-const` errors, and it does not honor `.gitignore`. Remove it before linting (or lint before starting Supabase): `rm -rf supabase/.temp/start-secrets`. On a clean tree `npm run lint` passes (only 2 warnings).

### Tests
`npm run test` (vitest): 393 pass, **12 pre-existing failures** unrelated to environment setup (files: `guards-rbac`, `order.service`, `sales-invoice.service`, `product-import`, `cross-tenant-isolation`, `onboarding-settings-parity`) — mostly unit tests invoking Next.js `headers()` outside a request scope, or mock drift. `npx tsc --noEmit` passes clean.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

The startup script only refreshes Node deps (`npm ci`). Docker and the Supabase CLI are already installed in the VM image, but nothing is running on a fresh pod — you must start the services yourself. Standard commands live in `README.md` / `package.json`; the notes below are the non-obvious caveats.

### Services

- Next.js dev server — `npm run dev` on http://localhost:3000. Reads `.env.local`. Auth guard redirects `/` → `/login`.
- Local Supabase stack (Postgres + Auth + PostgREST + Storage) — provides the DB/API the app talks to. Requires Docker.

### Bring the environment up (fresh pod)

1. Start the Docker daemon manually — systemd is not available in this container, so `sudo service docker start` won't work. Run `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock` (lets the Supabase CLI reach Docker without sudo).
2. `supabase start` (boots the stack; prints local API URL + anon/service keys).
3. `supabase db reset` (applies `supabase/migrations/*` + `supabase/seed.sql`).
4. **`bash scripts/dev-grant-api-roles.sh`** — REQUIRED after every `db reset`. See gotcha below.
5. `npm run db:seed-auth` (links demo Auth users; fails with "permission denied for table users" if step 4 was skipped).
6. `npm run dev`.

Note `scripts/dev-up.sh` runs steps 2/3/5/6 but NOT the grant step, so it fails at seed-auth on its own — run step 4 in between, or follow the sequence above.

### `.env.local`

Gitignored (persists on disk in the snapshot, not in git). Point it at the local stack using the keys from `supabase start`:
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, plus `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (both from `supabase start` output), and `SweetFlow_COOKIE_SECRET` (any 32+ char string; dev falls back to the service key if unset).

### Gotcha: API-role table grants after `db reset`

On this Supabase CLI version, `db reset` runs migrations as `postgres`, whose DEFAULT PRIVILEGES for schema `public` only grant TRUNCATE/REFERENCES/TRIGGER (not SELECT/INSERT/UPDATE/DELETE) to `anon`/`authenticated`/`service_role`. Supabase cloud grants `ALL`, which the app depends on, so without a fix every PostgREST query fails with `permission denied for table <name>`. `scripts/dev-grant-api-roles.sh` restores the cloud-equivalent grants (all 64 public tables have RLS enabled, so rows stay policy-gated). Re-run it after each reset.

### Lint / test notes

- `supabase start` writes a minified `supabase/.temp/**` file that ESLint picks up, producing ~150 spurious errors. For real repo lint use `npx eslint . --ignore-pattern 'supabase/.temp/**'`.
- Pre-existing (not environment issues): ~30 lint errors in app code, and 1 failing unit test (`tests/unit/online-order.service.test.ts` — its mock lacks the `app_settings` table the service now queries). `npm run typecheck` is clean.

### Demo login

`owner@CafeFlow.local` / `demo1234` (also manager / cashier1 / cashier2 / inventory / viewer @CafeFlow.local; cashier POS PIN `1234`).

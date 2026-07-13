# Deployment

SweetFlow supports **local demo** (seed data) and **production** (onboarding only). See [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md) before production cutover.

**Architecture authority:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md). Migration net state: [MIGRATION_AUDIT.md](./MIGRATION_AUDIT.md).

## Environment variables

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Service role for admin user provisioning |
| `SweetFlow_COOKIE_SECRET` | Yes (prod) | Server only | HMAC secret for device, cashier, and `sf_active_store` cookies (32+ chars). **Required in production** — app fails closed; never falls back to `SUPABASE_SERVICE_ROLE_KEY` (R9 / ADR-002). |
| `NEXT_PUBLIC_APP_URL` | Yes (prod) | Public | Canonical app URL (auth redirects, public menu links) |
| `PLATFORM_BOOTSTRAP_EMAILS` | No | Server only | Comma-separated emails bootstrapped into `platform_admins` on first authenticated `/platform` access. **Active after S02.** Use distinct lists per env — never share staging ↔ production. |
| `ONBOARDING_REQUIRE_INVITE` | No | Server only | When `true`, forces invite-gated onboarding even outside `NODE_ENV=production` (useful for staging-like local). **Ignored as a bypass:** production always requires an invite — there is no env flag that opens onboarding in prod. |

Copy from `.env.example` and fill values in your host (Vercel, Docker, etc.).

### Platform console (`/platform`)

1. Create a Supabase Auth user for each bootstrap email (password or invite).
2. Set `PLATFORM_BOOTSTRAP_EMAILS` (comma-separated, distinct per env).
3. Sign in → `/platform` (platform-only users land there automatically; tenant users open the URL).
4. Suspend/reactivate orgs, create company invites (copy token once), review `platform_audit_logs`.

Tenant owners without a `platform_admins` row (and not in bootstrap emails) see AccessDenied.

### Invite-gated onboarding (production)

1. Platform admin creates an invite in `/platform` and copies the **one-time** token.
2. Owner opens `/onboarding` (or `/onboarding?invite=<token>`) and pastes the token.
3. Bootstrap validates the token (pending, not expired, not reused), creates the org, then marks the invite `accepted` with `accepted_org_id`.
4. Reuse / expired / revoked tokens fail with clear Arabic errors.

**Production:** invite required (`NODE_ENV=production`).  
**Local demo escape hatch:** without `ONBOARDING_REQUIRE_INVITE`, local/dev onboarding may omit the token so `db:reset-demo` + `/onboarding` still work. This must never be enabled as a production bypass.  
**Headless** `scripts/bootstrap-org.mjs` remains an ops-only empty-DB tool (service role); prefer `/onboarding` + invite for real tenants.

## Database migrations

Apply **all** files under `supabase/migrations/` in lexical/version order (`supabase db push` / `db reset`). Do not stop at a hand-picked “through 038” list — later timestamped migrations are required.

### Notable migration facts (net state)

| Area | Migrations | Net state after full train |
|------|------------|----------------------------|
| Souqna (`030`, `031`) | Created then **dropped** by `20260612193243_cafeflow_legacy_cleanup.sql` (ADR-009) | **Not live** — do not treat as production Souqna |
| Platform console (`039`) | Created then **dropped** by the same cleanup (ADR-001); **restored** by `20260713133943_restore_platform_admin_console.sql` | Tables **present**; `/platform` UI live after S02 (bootstrap via `PLATFORM_BOOTSTRAP_EMAILS`) |
| Online menu / orders | Dropped in cleanup; **restored** by `20260618*` rebuild migrations | **Present** (first-party QR / online orders) |
| Monthly closing | Dropped in cleanup | **Not live** |

```bash
supabase link --project-ref <your-ref>
supabase db push
```

**Production:** do not run `seed.sql`. Use `/onboarding` with a platform invite token after deploy.

**Local demo:**

```bash
npm run db:reset-demo   # migrations + seed + auth users
npm run dev
```

## Vercel (example)

1. Import repository and set framework preset to Next.js.
2. Add environment variables from the table above.
3. Set build command: `npm run build` (or `npm run smoke:check` in a pre-deploy hook).
4. Deploy; open `/onboarding` with a valid platform invite (or `/onboarding?invite=<token>`).
5. In Supabase → Authentication → URL configuration, add:
   - Site URL: `https://your-domain.com`
   - Redirect URLs: `https://your-domain.com/auth/callback`, `https://your-domain.com/auth/callback?next=/reset-password`

## Release verification

```bash
npm run smoke:check
```

Manual QA: [SMOKE_TEST.md](./SMOKE_TEST.md)

## Headless bootstrap (optional)

For automation without the UI wizard (requires service role and empty database):

```bash
node scripts/bootstrap-org.mjs --email owner@example.com --password '...' --org "My Shop" --store "Main"
```

The onboarding wizard remains the recommended path for owners.

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run db:reset` | Supabase db reset (migrations + seed.sql) |
| `npm run db:reset-demo` | Reset + seed auth users (local demo) |
| `npm run db:seed-auth` | Link seed users to Supabase Auth |
| `npm run smoke:check` | Lint, typecheck, unit tests, build, migration/env sanity |

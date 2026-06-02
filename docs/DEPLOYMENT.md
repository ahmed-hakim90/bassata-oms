# Deployment

SweetFlow supports **local demo** (seed data) and **production** (onboarding only). See [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md) before production cutover.

## Environment variables

| Variable | Required | Scope | Description |
|----------|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Service role for admin user provisioning |
| `SweetFlow_COOKIE_SECRET` | Yes (prod) | Server only | Signs device + cashier cookies (32+ chars) |
| `NEXT_PUBLIC_APP_URL` | Yes (Souqna) | Public | Production URL for webhook/API endpoints in Settings |
| `PLATFORM_BOOTSTRAP_EMAILS` | No | Server only | Comma-separated emails allowed to re-open onboarding |

Copy from `.env.example` and fill values in your host (Vercel, Docker, etc.).

## Database migrations

Apply all files under `supabase/migrations/` in order through **038**:

- `018` — session management, checkout session enforcement
- `021` — POS device pairing
- `022` — tenant foundation, onboarding RPC, org storage
- `023` — customer accounts, ledger, wallet/credit payment types
- `025` — P0 production hardening (pairing, checkout caller binding, device validation)
- `026` — checkout wallet/credit sales and AR ledger posting
- `027` — split POS payment rows for cash/card/wallet/other combinations
- `028` — owner/manager expired-session checkout override
- `029` — purchase landed cost allocation fields
- `030` — Souqna integration (products, online orders, logs)
- `031` — Souqna provider completion (webhook, stats)
- `033` — business activity modes, pricing tiers, checkout hardening
- `034` — multi-org onboarding and tenant mutation policy hardening
- `035` — SECURITY DEFINER search_path hardening
- `036` — generalized inventory architecture (batch/expiry/serial foundations)
- `037` — P0 RLS coverage for generalized inventory tables and append-only audit logs
- `038` — simplified shelf-life value/unit model for products

```bash
supabase link --project-ref <your-ref>
supabase db push
```

**Production:** do not run `seed.sql`. Use `/onboarding` after deploy.

**Local demo:**

```bash
npm run db:reset-demo   # migrations + seed + auth users
npm run dev
```

## Vercel (example)

1. Import repository and set framework preset to Next.js.
2. Add environment variables from the table above.
3. Set build command: `npm run build` (or `npm run smoke:check` in a pre-deploy hook).
4. Deploy; open `/onboarding` on first visit.
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

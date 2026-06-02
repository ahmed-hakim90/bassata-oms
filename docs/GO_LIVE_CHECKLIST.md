# SweetFlow Go-Live Checklist

Use this checklist before pointing production traffic at a new deployment.

## Infrastructure

- [ ] Supabase production project created (Postgres 17+)
- [ ] All migrations applied through `031` (`supabase db push` or CI migration step)
- [ ] `030`/`031` applied if using Souqna integration
- [ ] `SweetFlow_COOKIE_SECRET` set (32+ random bytes; never commit)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set on host
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set server-only (Vercel/host secrets)
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain (Souqna webhooks + Settings)
- [ ] Supabase Auth redirect URLs include production `/auth/callback` and password reset paths
- [ ] Email provider configured in Supabase for password reset (if used)

## First organization (production)

- [ ] **Do not** run demo seed in production (`db:reset-demo` is local only)
- [ ] Complete `/onboarding` wizard as owner (org, store, owner user, feature flags)
- [ ] Sign in as owner and verify Settings → Business
- [ ] Create manager/cashier users with strong passwords (not demo defaults)

## POS & devices

- [ ] Pair each register via Settings → Devices pairing code or “Register this browser”
- [ ] Cashiers sign in with email/password; PIN switch optional per shift
- [ ] Open session, complete test sale (cash), close session with reconciliation
- [ ] Verify session blocks sales when expired (if enabled in session settings)

## Security & RBAC

- [ ] Review permissions matrix (Settings → Users → Permissions)
- [ ] Confirm viewer/inventory roles have expected nav access
- [ ] Monthly closing: close a test period and verify inventory/POS mutations block
- [ ] Run `npm run smoke:check` on release branch

## Accounting (if enabled)

- [ ] Cost centers and expense categories reviewed
- [ ] Supplier payments tested on staging
- [ ] Credit sales feature flag off unless AR workflow trained (`credit_sales`)

## Customer accounts (optional)

- [ ] Enable `credit_sales` only after credit limits and collections process defined
- [ ] Test credit sale → statement → payment on staging

## Backup & monitoring

- [ ] Supabase backups / PITR enabled per plan
- [ ] Error monitoring on host (Vercel logs, etc.)
- [ ] Owner contact for support documented

## Post go-live

- [ ] Remove `PLATFORM_BOOTSTRAP_EMAILS` exposure except trusted admins
- [ ] Rotate any credentials shared during setup
- [ ] Schedule first monthly close training with owner

## Souqna (if enabled)

- [ ] Migrations `030` and `031` applied
- [ ] API key and webhook secret configured in Settings → Souqna
- [ ] Test order import on staging before production

See [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md), [DEPLOYMENT.md](./DEPLOYMENT.md), and [SMOKE_TEST.md](./SMOKE_TEST.md).

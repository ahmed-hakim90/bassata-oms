# Production status

Last updated: 2026-08-08 (Top-5 gaps P0 ops pass)

## Done

| Item | Status |
|------|--------|
| Supabase project linked | Ops-managed (see local `.env` / Vercel) |
| Migrations | Apply **full** train under `supabase/migrations/` (incl. custom domains / bakery-pharmacy / modifiers-KDS) |
| Platform console `/platform` | Restored (ADR-001); bootstrap via `PLATFORM_BOOTSTRAP_EMAILS` |
| Online menu / orders | First-party QR menu (Souqna **not** live — ADR-009) |
| Vercel production | https://velora-oms.vercel.app |
| Cookie HMAC | `VELORA_COOKIE_SECRET` required in prod (legacy `SweetFlow_COOKIE_SECRET` dual-read) |
| Transactional email code path | Resend templates wired |

## P0 ops checklist (signed 2026-08-08)

| Check | Result | Evidence |
|-------|--------|----------|
| `RESEND_API_KEY` on Vercel Production | **Pass** | `vercel env ls` — present after push from `.env.local` |
| `EMAIL_FROM` on Vercel Production | **Pass** | same |
| `RESEND_*` / `EMAIL_FROM` on Preview | **Pass** | pushed for staging mail smoke |
| Core secrets on Production (`VELORA_COOKIE_SECRET` and/or legacy `SweetFlow_COOKIE_SECRET`, Supabase URL/anon/service, `NEXT_PUBLIC_APP_URL`) | **Pass** | legacy present; push canonical via `npm run vercel:env` |
| Core secrets slots on Preview | **Pass** | present (distinct values **not** re-verified by decrypt — ops must confirm Preview ≠ Production periodically) |
| `PLATFORM_BOOTSTRAP_EMAILS` Production + Preview | **Pass (slots)** | present; keep lists tight per env |
| Supabase Auth Site URL + Redirect URLs (platform host) | **Operator confirm** | Dashboard → Auth → URL config: `https://velora-oms.vercel.app/auth/callback` (+ reset variant) |
| Email smoke (forgot / invite / session close) | **Operator confirm** | Prod redeployed 2026-08-08 with Resend; run forgot/invite/session-close once |
| Redeploy after env push | **Pass** | `dpl_49GVy9K2gGQbgp2tS1vZRUk3GqTi` → https://velora-oms.vercel.app (READY) |

### Supabase Auth → URL configuration (keep)

- **Site URL:** `https://velora-oms.vercel.app`
- **Redirect URLs:**
  - `https://velora-oms.vercel.app/auth/callback`
  - `https://velora-oms.vercel.app/auth/callback?next=/reset-password`
  - For each **active custom org domain:** `https://<custom-domain>/auth/callback` (+ reset)

### Staging / activity smoke

See [results/activity-matrix-smoke-results.md](./results/activity-matrix-smoke-results.md) and [SMOKE_TEST.md](./SMOKE_TEST.md).

### Custom domain pilot

See [results/custom-domain-pilot-results.md](./results/custom-domain-pilot-results.md) and [CUSTOM_DOMAINS.md](./CUSTOM_DOMAINS.md).

## Commercial track (signed order)

| Step | Item | Status |
|------|------|--------|
| 1 | Hardware pilot on store devices | **Next** — [DEVICE_MATRIX.md](./DEVICE_MATRIX.md) · [results/hardware-pilot-results.md](./results/hardware-pilot-results.md) |
| 2 | Manual SaaS (plans/limits + suspend, no Stripe) | **Ready for ops** — capacity on create; suspend blocks login; non-payment reason + plan note; org-status fail-closed |
| 3 | Billing (Stripe / Marketplace) | Deferred until post-pilot revenue |
| 4 | Brand unify (Velora vs SweetFlow/CafeFlow) | **Done** — [BRAND_UNIFY.md](./BRAND_UNIFY.md); UI kit `Velora/`; env `VELORA_COOKIE_SECRET` + legacy dual-read |
| 5 | Offline / weak network | Phase 10 — after online-stable |

## Not live / deferred

| Item | Notes |
|------|--------|
| Souqna marketplace | Dropped (ADR-009) |
| Monthly closing | Restored (`/monthly-closing` + period lock) |
| General ledger | Live — CoA, journals, ledger, P&L, balance sheet + auto-post/reverse (`/accounting`) |
| Stripe billing | Deferred (commercial track step 3 / Phase 9) |

## Commands

```bash
npm run smoke:check
npm run vercel:env
npx vercel deploy --prod
```

## Production URL

https://velora-oms.vercel.app

# S16 Smoke / Production Gate Results

**Date:** 2026-07-13 (updated evening residual fix)  
**Sprint:** S16 — Staging, Smoke, Device Matrix, Ops Hardening  
**Environment:** Local Supabase (`supabase start`) + linked remote via `.env.local` after `npm run db:seed-auth`.

## Automated (recheck after residual fixes)

| Check | Result | Notes |
|-------|--------|-------|
| Local `supabase start` / migrations + seed | **Pass** | `'paid'` order_status fixed; warehouse `org_id` guard uses `to_jsonb` |
| `npm run db:seed-auth` | **Pass** | CafeFlow.local demos + optional ADMIN |
| `npm run smoke:check` | **Pass** | Against stack with cookie secret |
| `npm run verify:rls-policies` | **Pass** | 65 tables |
| `npm run verify:post-006` | **Pass** | Local + remote after demo seed |
| `npm run verify:p0-security` | **Pass** | Inventory (not cashier) cannot insert orders — matches SMOKE_TEST |
| `npm run verify:inventory-crud` | **Pass** | Supplier id aligned to seed `…0501` |
| `npm run verify:supplier-payments` | **Pass** | Local |
| `npm run verify:production` | **Pass** | Local env overrides for URL/keys |
| `E2E_FULL_POS=1` Playwright | **Partial** | S10 skeleton Pass; cart/checkout needs device pair |

## Manual / staging

| Section | Status |
|---------|--------|
| Staging browser SMOKE_TEST | **Not run** |
| Device matrix Required | Untested / Partial |
| Full paired-device cashier sell day | **Open** (M3) |

## Honesty gate

Do **not** treat this as Milestone 3 or 6 exit. Demo-auth automated gate is cleared; staging + hardware + full POS sell path remain.

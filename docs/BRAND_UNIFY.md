# Brand unify — Velora

**Decision date:** 2026-08-08  
**Product brand:** Velora  
**Status:** Phase C applied (code + dual-read secrets)

## What changed

| Surface | Before | After |
|---------|--------|-------|
| Operator / customer brand | Mixed Velora / SweetFlow / CafeFlow | **Velora** |
| UI kit folder | `src/components/SweetFlow/` | `src/components/Velora/` |
| Cookie HMAC env | `SweetFlow_COOKIE_SECRET` | **`VELORA_COOKIE_SECRET`** (canonical) |

## Dual-read (do not break production)

`resolveCookieSigningSecret()` reads, in order:

1. `VELORA_COOKIE_SECRET`
2. `SweetFlow_COOKIE_SECRET` (legacy alias)

Production still works if only the legacy env is set. Prefer setting both to the **same** value during the transition (`npm run vercel:env` syncs them).

## Explicitly unchanged (wire stability)

| Item | Why |
|------|-----|
| Cookie names `sf_active_store`, `sf_registered_device`, `sf_active_cashier`, `sf_host_org` | Renaming invalidates all paired devices / sessions |
| Demo auth emails `@CafeFlow.local` | Seeded identities; changing requires auth reseed |
| Historical migrations / closed plan docs | Audit trail |
| Docker volume name `SweetFlow_pg` | Avoid wiping local Postgres data |

## Ops follow-up

1. Ensure Production + Preview have `VELORA_COOKIE_SECRET` (or keep legacy until pushed).
2. After both envs carry the canonical key, legacy may be removed in a later cleanup.
3. Do not rotate the secret value during rename unless intentionally invalidating all signed cookies.

# MVP Feature Freeze

**Status:** Sealed for Phase 1 gate  
**Sealed date:** 2026-07-11  
**Rule:** No new features until after Pilot (Phase 4) except **P0 bugfixes** and Phase 0 quality polish already in flight.

Companion plans: [PRODUCT_EXECUTION_PLAN.md](./PRODUCT_EXECUTION_PLAN.md) · [COMPLETION_PLAN.md](./COMPLETION_PLAN.md)

## IN scope (MVP — must work for Pilot)

| Area | Included |
|------|----------|
| Auth | Login, password reset flow (SMTP later in Phase 3), onboarding wizard |
| POS device | Pairing, readiness gates, PIN cashier switch |
| Cashier day | Open session, sell (cash/card/wallet/split), hold/park, discounts + manager override, receipt print/skip, close session |
| Credit sales | Only if `credit_sales` flag enabled and staff trained; otherwise leave flag off |
| Catalog | Products, categories, variants, recipes (as already built) |
| Customers | Profiles, basic loyalty as already built |
| Inventory | Stock levels, purchases, transfers, stock count, waste, suppliers, warehouses |
| Orders | List, detail, refunds as already built |
| Expenses | List + wizard |
| Online | Public QR menu `/menu/[slug]`, online orders fulfillment |
| Reports | Existing sales/inventory/expenses/sessions/profit hubs and print routes |
| Settings | Business, users/permissions, devices, branches, feature flags, Souqna if used |
| Print | `(print)` routes + POS receipt path |

## OUT of scope (defer past Pilot)

| Area | Notes |
|------|-------|
| Offline / PWA | Explicitly out of MVP |
| Advanced loyalty / coupons / campaigns | |
| Full P&L / tax export / aging reports polish | Beyond current report hubs |
| Batch/expiry deep workflows | Foundations may exist; full ops UX later |
| SaaS billing / multi-tenant super-admin polish | |
| Broad brand rename of env/cookies/packages | Frozen per STABILIZATION_PLAN |
| WhatsApp/SMS marketing automation | |
| iPad as committed target | Best-effort only — see DEVICE_MATRIX |

## Freeze checklist (scan before declaring Phase 1 done)

- [x] Auth / onboarding / pairing present in codebase
- [x] POS day flow components present (session, cart, payment, receipt, overrides)
- [x] Print routes under `src/app/(print)`
- [x] QR menu + online orders modules present
- [x] CRUD surfaces for products, customers, expenses, purchases, inventory
- [x] No module `TODO`/`FIXME` stubs blocking day flow (verified 2026-07-11)
- [ ] Manual walkthrough of IN-scope flows on demo DB (Stabilization Phase 2)
- [ ] Feature flags for non-ready capabilities left **off** in pilot org

## Change policy during freeze

| Allowed | Not allowed |
|---------|-------------|
| P0 correctness / security / data-loss fixes | New product features |
| Acceptance/perf/error UX polish on IN screens | New modules or major schema |
| Docs + pilot runbooks | Expanding OUT items into Pilot |

To unfreeze: owner signs off after Pilot week + backlog triage.

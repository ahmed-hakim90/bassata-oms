# Migration Audit — Platform & Online Menu Net State

**Sprint:** S00 (Truth & Freeze Alignment)  
**Date:** 2026-07-13  
**Authority:** [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) (ADR-001, ADR-009)  
**Scope:** Read-only inspection. No schema changes in S00.

---

## Summary

After the full migration train (including cleanup `20260612193243_cafeflow_legacy_cleanup.sql` / remote sibling `20260612193356`), **platform control-plane tables were absent** (S00). **S01** restored them via forward migration `20260713133943_restore_platform_admin_console.sql` (ADR-001). Online menu/order tables remain restored from earlier rebuild migrations. Souqna and monthly closing remain dropped.

---

## Evidence sources

| Source | What was inspected |
|--------|-------------------|
| Local migration files | `039_platform_admin_console.sql`, `20260612193243_cafeflow_legacy_cleanup.sql`, `20260618203548_online_menu_orders_rebuild.sql`, `20260618151334_restore_online_menu_public_catalog.sql` |
| Linked remote DB (`user-supabase-basata-oms`) | `to_regclass` / `pg_class` presence checks; `supabase_migrations.schema_migrations`; function def for `platform_organization_data_size` |
| App tree | No `src/app/**/platform/**`; no `src/modules/monthly-closing/` |

---

## Table presence (yes / no)

| Table | Created in | Dropped in | Restored later? | Net after full train (files) | Present on inspected remote DB |
|-------|------------|------------|-----------------|------------------------------|--------------------------------|
| `platform_admins` | `039_platform_admin_console.sql` | cleanup `…193243` / remote `…193356` | **Yes** — `20260713133943_restore_platform_admin_console.sql` (S01) | **Yes** (post-S01) | **Yes** (after S01 apply) |
| `platform_company_invites` | `039` | cleanup | **Yes** — S01 restore | **Yes** | **Yes** |
| `platform_audit_logs` | `039` | cleanup | **Yes** — S01 restore | **Yes** | **Yes** |
| `online_orders` | `012` (orig); rebuild `20260618203548` | cleanup | **Yes** — rebuild | **Yes** | **Yes** |
| `online_order_items` | `012` / rebuild | cleanup | **Yes** — rebuild | **Yes** | **Yes** |
| `souqna_api_requests` | `030` | cleanup | **No** (ADR-009) | **No** | **No** |
| `souqna_integration_logs` | `030` | cleanup | **No** | **No** | **No** |
| `monthly_closes` | earlier schema | cleanup | **No** | **No** | **No** |

### Cleanup excerpt (drop evidence)

From `supabase/migrations/20260612193243_cafeflow_legacy_cleanup.sql`:

```sql
DROP TABLE IF EXISTS online_order_items CASCADE;
DROP TABLE IF EXISTS online_orders CASCADE;
DROP TABLE IF EXISTS souqna_integration_logs CASCADE;
DROP TABLE IF EXISTS souqna_api_requests CASCADE;
DROP TABLE IF EXISTS platform_audit_logs CASCADE;
DROP TABLE IF EXISTS platform_company_invites CASCADE;
DROP TABLE IF EXISTS platform_admins CASCADE;
DROP TABLE IF EXISTS monthly_closes CASCADE;
```

### Online menu restore evidence

- `20260618203548_online_menu_orders_rebuild.sql` — recreates `online_orders` / `online_order_items` + RLS.
- `20260618151334_restore_online_menu_public_catalog.sql` — restores public catalog / menu settings path.
- Remote migration history includes `20260618205445_online_menu_orders_rebuild` (timestamp sibling) and later online-order fixes.

---

## Related objects (not tables)

| Object | Net state | Notes |
|--------|-----------|-------|
| `platform_organization_data_size(uuid)` | **Present** (S01) | Recreated with purchases counted via `purchase_invoices JOIN stores` — **no** `purchase_invoices.org_id`. Verified on remote: `rpc_shape=OK_stores_join`. |
| `/platform` UI | **Absent** | No route under `src/`; S02 wires UI after S01 tables. |
| Monthly closing module | **Absent** | No `src/modules/monthly-closing/`; feature flag stripped in cleanup. |
| Souqna Settings / webhooks | **Not live** | Tables dropped; do not document as production-ready (ADR-009). |

`purchase_invoices` has **no** `org_id` column (schema since `001_initial_schema.sql` — store-scoped only). The buggy `WHERE org_id = p_org_id` form in `039` must not be reintroduced.

---

## S00-T5 — MVP_FREEZE vs Phase 0–1 (agreement)

Per [MASTER_ARCHITECTURE.md](./MASTER_ARCHITECTURE.md) Phase 0 and [MVP_FREEZE.md](./MVP_FREEZE.md):

| Topic | Agreement |
|-------|-----------|
| Phase 0–1 **P0 security / tenant isolation** (restore platform tables, invite gating, hardening) | **Allowed** under freeze as **P0 security / correctness** — not “new product features.” |
| SaaS **billing** / plans / Stripe / limits polish | **Deferred** (MVP_FREEZE OUT; MASTER Phase 9). |
| Platform UI polish beyond minimal control plane | Super-admin **polish** stays OUT; minimal `/platform` for suspend/invite/audit is Phase 1 isolation work after S01. |
| Souqna resurrection | **Not** in scope unless product re-approves (ADR-009). |

This audit is the written team agreement for S00-T5.

---

## Doc corrections driven by this audit

| Doc | Correction |
|-----|------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Souqna 030–031 marked dropped; platform not live until ADR-001 |
| [README.md](../README.md) | No live `/platform` / monthly-closing claims |
| [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md) | Align with MASTER (Souqna deferred, platform deferred, monthly close removed) |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Path casing `src/components/SweetFlow/` |

---

## S01 completed (ADR-001 restore)

Forward migration `supabase/migrations/20260713133943_restore_platform_admin_console.sql`:

1. Idempotently recreated `platform_admins`, `platform_company_invites`, `platform_audit_logs` + deny-all RLS.
2. Recreated `platform_organization_data_size` with purchases counted via stores (RPC returns on remote).
3. Did **not** delete or rewrite historical cleanup migration files.
4. Applied on linked remote; types regenerated into `src/lib/supabase/database.types.ts`.
5. Local `supabase db reset` not run this session (Docker daemon unavailable) — migration file is ready for local reset when Docker is up.

**Still not live:** `/platform` UI (S02). Platform tables alone do not mean the console is product-ready.

---

## S06 — service_role (`createAdminClient`) inventory

**Date:** 2026-07-13  
**Rule:** Every tenant data query via service_role must filter `org_id` and/or `store_id` (or be an intentional control-plane / global exception).

| Call site | Purpose | Tenant filter | Status |
|-----------|---------|---------------|--------|
| `src/lib/org-status.ts` | Suspended org check | `.eq("id", orgId)` | OK |
| `src/lib/repositories/organization.repository.ts` `countOrganizations` | Deployment/onboarding gate (global count) | N/A — intentional global | Exception (documented) |
| `src/modules/onboarding/services/bootstrap.service.ts` | Org bootstrap, logo, audit, rollback | Store ops `.eq("org_id", orgId)`; org/user inserts carry `org_id`; logo path `{orgId}/` | OK (S06 hardened store update) |
| `src/modules/system/services/users.service.ts` | Auth user create/reset + profile insert | Profile insert `org_id`; cleanup delete `.eq("org_id", orgId)` | OK (S06 hardened cleanup) |
| `src/modules/online-menu/services/online-menu.service.ts` | Public menu by slug | Products/categories `.eq("org_id", store.org_id)`; visibility filters | OK (S05) |
| `src/modules/online-orders/services/online-order.service.ts` | Public order create + customer upsert | Products/customers `.eq("org_id", storeOrgId)`; order `store_id` | OK (S05) |
| `src/modules/platform/services/platform-*.ts` | Control plane (admins, orgs, invites, audit) | Platform tables / org by id for suspend | OK — control plane (ADR-001) |

**Review gate:** New `createAdminClient()` usages must be added to this table with an explicit filter justification before merge.

**Related authenticated defense-in-depth (S06):** `online-order.repository` lists/gets/updates scoped via `listStores()` store ids (same pattern as `order.repository`).

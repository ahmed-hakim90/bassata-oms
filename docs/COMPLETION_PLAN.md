# SweetFlow Completion Plan

This plan tracks the remaining work to turn SweetFlow from a strong release candidate into a complete production operations platform.

## Stabilization rule

Broad brand renaming is frozen until the core product flows are stable. Keep internal names, env vars, cookie prefixes, package names, component import paths, seeds, and scripts unchanged. See [STABILIZATION_PLAN.md](./STABILIZATION_PLAN.md).

## Phase 1 — Release candidate hardening

- [x] Add a CI quality gate for lint, typecheck, unit tests, build, env, and migration sanity.
- [x] Include unit tests in `npm run smoke:check`.
- [x] Migrate the deprecated Next.js `middleware.ts` convention to `proxy.ts`.
- [x] Clean current lint warnings or mark intentional exceptions locally.
- [ ] Keep broad brand rename frozen until POS/device/onboarding/security flows are stable.
- [ ] Run the full manual smoke checklist on a reset local demo database.
- [ ] Run the full manual smoke checklist on staging.
- [ ] Record known staging gaps before production cutover.

## Phase 2 — POS day flow

- [ ] Clarify device pairing and register state whenever POS blocks access.
- [ ] Receipt view/print workflow with store branding, tax, cashier, payments, and refund references.
- [x] Split payments across cash, card, wallet, and other.
- [x] Partial credit split with AR ledger support.
- [x] Order-level POS discount workflow gated by `customer_discounts`.
- [ ] Product and manager-approved discount workflows.
- [x] Manager override for large POS discounts with audit logging.
- [x] Manager override for expired-session sale with audit logging.
- [x] Manager override for cash drawer open with audit logging.
- [x] Hold/park order workflow for interrupted sales.
- [ ] Full cashier E2E: open session, sell, refund, add expense, close session, verify variance.

## Phase 3 — Inventory and costing

- [x] Low-stock alerts surfaced on inventory pages.
- [x] Reorder suggestions based on reorder points.
- [x] Consumption-aware reorder suggestions.
- [x] Supplier price history per product and purchase line.
- [x] Landed cost allocation for extra purchase costs.
- [ ] Tax/freight-specific landed cost breakdown.
- [ ] Batch and expiry tracking for ingredients.
- [ ] Recipe versioning so historical margins remain stable after recipe changes.
- [x] Stock count approval workflow before posting adjustments.
- [ ] Barcode label export or printing workflow.

## Phase 4 — Finance and accounting

- [x] Daily close report per store with expected cash, actual cash, variance, paid in/out, and payment settlement. (`/reports/daily-close` — S15)
- [x] Supplier aging report. (`/reports/aging` AP — S15)
- [x] Customer aging report with collection workflow. (`/reports/aging` AR — S15; collection remains on customer page)
- [ ] Simple profit and loss report by date range and store.
- [x] Tax report and accounting-ready export. (`/reports/tax` + Excel — S15)
- [ ] Expense approval workflow for large or sensitive expenses.

## Phase 5 — Customer growth

- [ ] Flexible loyalty rules by amount, category, product, birthday, or campaign.
- [ ] Coupons and promotion codes.
- [ ] Customer segmentation: VIP, frequent, inactive, credit-risk.
- [ ] Customer merge workflow for duplicate phone/profile records.
- [ ] WhatsApp/SMS integration hooks for order status and campaigns.

## Phase 6 — Online ordering

- [x] Customer-facing order status page. (`/track/[token]` — S14)
- [x] Store opening hours and online ordering availability windows. (S13)
- [x] Product availability controls for public menu. (`show_on_online_menu`)
- [x] Pickup/delivery mode, delivery fees, and delivery zones. (S14)
- [ ] WhatsApp confirmation link or automated notification hook.
- [ ] Stronger branch-specific QR menu branding.

## Phase 7 — Executive analytics

- [ ] Owner dashboard for today sales, cash, open sessions, low stock, waste, and top products.
- [ ] Branch comparison by revenue, margin, waste, and order count.
- [ ] Period comparison: today/yesterday, week/week, month/month.
- [ ] Hourly sales heatmap.
- [ ] Cashier performance report.
- [ ] Product/category gross margin report.
- [ ] Scheduled report exports.

## Phase 8 — Production operations

- [ ] Dedicated staging Supabase project and hosted staging app.
- [ ] Production Supabase project with backups/PITR enabled.
- [ ] Error monitoring, alerting, and log review workflow.
- [ ] Password reset email provider configured.
- [ ] Backup restore drill documented and tested.
- [ ] Migration workflow from staging to production.
- [ ] Owner recovery and credential rotation procedure.

## Phase 9 — SaaS readiness

- [ ] Super-admin console for tenant lookup, suspension, support, and health checks.
- [ ] Subscription plans and billing integration.
- [ ] Plan limits for stores, devices, users, and advanced features.
- [ ] Tenant lifecycle: create, suspend, reactivate, export, delete.
- [ ] Audited support impersonation workflow.
- [ ] Tenant data export/delete process.

## Testing gates

Before a production release:

- [ ] `npm run smoke:check` passes locally.
- [ ] CI `quality-gate` passes on the release branch.
- [ ] Manual smoke test passes locally or on staging.
- [ ] Security/RLS verification scripts pass against the target environment.
- [ ] Any enabled E2E suite passes against seeded staging data.

# SweetFlow POS — Smoke Test Checklist

Run after `supabase db reset` (or `npm run db:push`), `npm run db:seed-auth`, and `npm run dev`.

## Release gate (automated)

```bash
npm run smoke:check
```

Equivalent to `lint` + `tsc --noEmit` + `vitest run` + `build` + env/migration file checks.

| Check | Status |
|-------|--------|
| `npm run lint` | Run `npm run smoke:check` locally |
| `npx tsc --noEmit` | Included in smoke:check |
| `npm run test` | Included in smoke:check |
| `npm run build` | Included in smoke:check |
| Migration files 001–031 present | Included in smoke:check |
| `SweetFlow_COOKIE_SECRET` set | Required in CI/production (`smoke:check`) |

After applying `006_fix_flags_and_org_rls.sql` on remote, run:

```bash
node scripts/verify-post-006.mjs
```

This signs in as owner and verifies organization UPDATE (Settings) and transfer INSERT (Transfers) under RLS.

## Fix 500 regression (browser) — manual

Login as **owner** or **manager** (`owner@SweetFlow.local` / `demo1234` after `npm run db:seed-auth`).

- [ ] **Settings → Organization** — save name/currency; no 500 (`Cannot coerce...`)
- [ ] **Inventory → Transfers** — create draft between two stores; no `Feature disabled: transfers`
- [ ] (Optional) Disable `transfers` in Settings → create transfer fails in UI and DB

## Inventory edit / void — manual

Requires migration `009_inventory_cancelled_status.sql` (`npm run verify:inventory-crud`).

- [ ] **Transfers** — open draft from list; change from/to stores (Save), edit line qty, remove line, delete draft
- [ ] **Transfers** — send transfer, then **Cancel Send** (void); stock restored at source
- [ ] **Transfers** — receive transfer, then **Void Transfer**; stock reversed at both stores
- [ ] **Purchases** — open draft; edit supplier/invoice #, line qty/cost, delete line, delete draft
- [ ] **Purchases** — receive invoice, then **Void Receipt**; stock reduced

## Owner path (browser) — manual

- [ ] Login as owner (`owner@SweetFlow.local` / password from seed-auth)
- [ ] Create store, device, and cashier user
- [ ] Switch store in header (name shown, not UUID)
- [ ] Pair POS terminal at `/device/pair` (pairing code) or **Register this browser** in Settings → Devices
- [ ] Cashier login at `/login` (`cashier1@SweetFlow.local` / `demo1234` after seed-auth)
- [ ] Optional: switch cashier via PIN on `/pos`
- [ ] Open session with opening cash
- [ ] Complete checkout (cash)
- [ ] Add session expense at `/expenses` (readiness states clear before ready)
- [ ] Refund an order
- [ ] Close session; verify variance
- [ ] Confirm audit log entry at `/audit` with filters and pagination

## P0 production security — automated + manual

After `supabase db reset` and `npm run db:seed-auth`:

```bash
node scripts/verify-p0-security.mjs
```

- [ ] `pin_codes` direct SELECT denied for authenticated users
- [ ] Viewer cannot INSERT into `orders`
- [ ] `consume_device_pairing_code` not callable by `anon` (migration `025`)
- [ ] Device pairing requires sign-in (`/device/pair` is not a public route)
- [ ] Revoke `pos_access` for a manager in Settings → Permissions → manager cannot open `/pos`
- [ ] Pairing code brute-force: 10+ bad codes within 15 min → rate limited
- [ ] Checkout with wrong `device_id` rejected (app + DB `complete_checkout`)
- [ ] `auth.login_failed` / `cashier.pin_failed` / `device.paired` appear in audit log when triggered

## Security — manual

- [ ] Cashier cannot open `/settings`, `/users`, `/reports` (Access denied UI)
- [ ] Inventory role cannot open `/pos` (Access denied on operational layout)
- [ ] Viewer cannot mutate (actions return 403)
- [ ] Disabled feature flag blocks server action (e.g. disable `refunds`, retry refund)
- [ ] Disabled `session_expenses` blocks expense insert (DB trigger)
- [ ] Missing/forged `sf_active_cashier` or unregistered device → checkout rejected

## Database — manual (Supabase SQL or client)

- [ ] `pin_codes`: direct SELECT/INSERT denied for authenticated user
- [ ] `audit_logs`: UPDATE/DELETE denied
- [ ] Viewer cannot INSERT into `orders`
- [ ] Inventory cannot INSERT into `orders` (RLS 005)

## Role matrix (quick)

| Role | POS checkout | Settings | Reports | Inventory modules |
|------|--------------|----------|---------|-------------------|
| owner | yes | yes | yes | yes |
| manager | yes | yes | yes | yes |
| cashier | yes (email + optional PIN switch) | no | no | no |
| viewer | no | no | read | no |
| inventory | no (POS blocked) | no | no | yes |
| viewer | no | no | read | no |

## Recipes / profit — manual

Requires migration `014_recipe_demo_seed.sql` and `recipes` feature flag enabled.

- [ ] **Products** — Mango Juice, Ice Cream Cup, and 5 ingredients visible
- [ ] **Product → Recipe tab** — lines, cost, profit, and margin preview
- [ ] **POS** — Mango Juice shows makeable-qty badge; sell 1 unit
- [ ] **Inventory → Ingredients** — Mango Bag, Cup, Straw stock reduced (not finished product)
- [ ] **Reports** — COGS and profit > 0 after sale (owner/manager)
- [ ] **Refund order** — ingredients restored from `order_item_deductions` snapshot
- [ ] **Purchases** — product select shows unit (e.g. `Mango Bag · Bag`)

## Accounting & RBAC (011, 015) — manual

Login as **owner** (`owner@SweetFlow.local`).

- [ ] **Settings → Cost Centers** — create/edit cost center and expense category
- [ ] **Expenses** — create external expense with cost center and category
- [ ] **Users → Permissions tab** — verify permission matrix loads; toggle override for a user
- [ ] Login as **inventory** (`inventory@SweetFlow.local`) — can access inventory modules, blocked from POS and settings

## Online orders & QR menu (012) — manual

- [ ] **Settings → Store** — copy QR menu link for Downtown
- [ ] Open QR link in incognito (no login) — public menu loads
- [ ] Submit online order — appears in **Online Orders** queue
- [ ] Accept order → invoice to POS or mark ready

## Multi-warehouse (013) — manual

- [ ] **Settings → Warehouses** — verify default warehouse per store
- [ ] **Inventory hub** — stock shown per warehouse
- [ ] **Purchases** — receive into specific warehouse

## Supplier payments (016) — manual

- [ ] **Inventory → Suppliers** — open supplier detail
- [ ] Record payment against outstanding balance
- [ ] Verify statement reflects payment

## Product variants (017) — manual

Requires migration `017_product_variants_recipes.sql`.

- [ ] **Products → Vanilla Scoop → Variants** — Small/Large variants with different prices
- [ ] **Variant recipe** — Small uses 80g vanilla, Large uses 150g
- [ ] **POS** — tap Vanilla Scoop → variant picker → add to cart with correct price
- [ ] **Checkout** — ingredient deduction uses variant-specific recipe
- [ ] **Reports** — sales breakdown shows variant-level quantities

## Auth & password — manual

- [ ] **Forgot password** — `/forgot-password` sends reset email (Supabase mail configured)
- [ ] **Reset password** — link opens `/reset-password`, new password works at login
- [ ] **Account** — signed-in user can change password at `/account`
- [ ] **Users → Password reset** — owner sets new password for a team member

## Customer accounts (023, 026) — manual

Enable `credit_sales` in Settings → System Features for credit POS.

- [ ] Set customer **credit limit** on customer profile
- [ ] **POS** — select customer, pay with **Credit**, order completes
- [ ] **Customer profile** — statement shows debit; balance increases
- [ ] **Receive payment** — record collection; balance decreases
- [ ] **Reports** — Customer accounts section shows outstanding and aging

## Notes

- Apply migrations through `031_souqna_provider_completion.sql` on each environment.
- Full rollout phases: [PRODUCTION_PLAN.md](./PRODUCTION_PLAN.md).
- Demo viewer: `viewer@SweetFlow.local` / `demo1234` (read-only orders/reports).
- Migration `010` was intentionally skipped — no functional gap.
- Apply migration `005_feature_flags_and_rls_roles.sql` before DB security tests.
- See [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) for flag enforcement layers.

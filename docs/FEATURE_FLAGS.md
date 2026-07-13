# Feature flags — enforcement layers

SweetFlow feature flags live in `app_settings.key = 'feature_flags'` (JSONB).

**Canonical app list:** [`FEATURE_FLAGS` / `DEFAULT_FEATURE_FLAGS`](../src/lib/constants.ts).  
`getFeatureFlags()` merges only known keys from that list (orphan JSON keys are ignored).

## Three layers

| Layer | Where | Coverage |
|-------|--------|----------|
| **UI** | [`src/lib/auth/nav.ts`](../src/lib/auth/nav.ts), POS payment filter, Settings tabs | Hides nav and disabled payment methods |
| **Server actions** | [`requireFeature`](../src/lib/auth/guards.ts) on module actions | Blocks mutations from the Next.js app |
| **Database** | `is_feature_enabled()` + triggers (migration `005`) + `complete_checkout` RPC (`003`) | Blocks direct Supabase client writes |

## Database-enforced flags (migration 005)

- `session_expenses` — `expenses` INSERT/UPDATE
- `refunds` — `orders` when `status = 'refunded'`
- `purchases` — `purchase_invoices`
- `transfers` — `transfer_orders`
- `waste` — `waste_records`
- `stock_count` — `stock_counts`
- Checkout RPC: `inventory_deduction`, `payment_*`, `customer_discounts`, `tax`, `prevent_negative_stock`

`monthly_closing` triggers were removed with the monthly closes table (cleanup). Do not re-enable in app Settings until period lock returns (Future).

## App-wired flags (Settings)

### System Features tab (`ADVANCED_FEATURE_FLAGS`)

Barcode, inventory deduction, loyalty, discounts, reports, imports/exports, dark mode, prevent negative stock, session expenses, refunds, stock count, transfers, purchases, waste, recipes, credit sales.

### POS & Sessions tab (`POS_OPERATIONAL_FEATURE_FLAGS`)

`payment_cash` / `payment_card` / `payment_wallet` / `payment_other`, `receipt_printing`, `cash_drawer`, `tax`.

### Hardware / shell

- `dark_mode` — theme toggle; forced light when disabled
- `barcode_scanner` — POS scan field
- `receipt_printing` — print after checkout
- `cash_drawer` — hook after cash checkout

## Online menu / orders (not feature_flags)

Cleanup migration stripped `online_menu` and `online_orders` from `feature_flags`.  
**Control plane:** per-store settings (`online_menu_enabled`, `online_menu_ordering_enabled`, slug/token/unlisted) — Branch settings UI.  
Do **not** re-add these keys to `FEATURE_FLAGS` unless product re-approves org-level kill switches.

## Orphan / legacy keys (may linger in DB JSON)

| Key | Status |
|-----|--------|
| `online_menu`, `online_orders` | Stripped; use store settings |
| `monthly_closing` | Future; ignore if present |
| `supermarket_mode`, `weight_sales`, `price_by_amount`, `wholesale_sales`, `product_price_tiers`, `fixed_weight_variants` | Legacy; source of truth is `business_activity` |

`initialize_organization` (post-cleanup) may still seed some activity legacy keys for backwards compatibility; the app does not expose or enforce them via `FEATURE_FLAGS`.

## Default when flag missing

- DB `is_feature_enabled()` returns `false` if the key is absent.
- App server actions use [`DEFAULT_FEATURE_FLAGS`](../src/lib/constants.ts) then overlay stored booleans for known keys only.

## S06 parity checklist

- [x] App `FEATURE_FLAGS` matches editable Settings surface
- [x] `online_menu` / `online_orders` documented as store-settings, not flags
- [x] Orphan keys documented; `getFeatureFlags` ignores them
- [x] Docs match `constants.ts` + post-cleanup seed behavior

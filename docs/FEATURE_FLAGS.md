# Feature flags — enforcement layers

SweetFlow feature flags live in `app_settings.key = 'feature_flags'` (JSONB).

## Three layers

| Layer | Where | Coverage |
|-------|--------|----------|
| **UI** | [`src/lib/auth/nav.ts`](../src/lib/auth/nav.ts), POS payment filter | Hides nav and disabled payment methods |
| **Server actions** | [`requireFeature`](../src/lib/auth/guards.ts) on module actions | Blocks mutations from the Next.js app |
| **Database** | `is_feature_enabled()` + triggers (migration `005`) + `complete_checkout` RPC (`003`) | Blocks direct Supabase client writes |

## Database-enforced flags (migration 005)

- `session_expenses` — `expenses` INSERT/UPDATE
- `refunds` — `orders` when `status = 'refunded'`
- `purchases` — `purchase_invoices`
- `transfers` — `transfer_orders`
- `waste` — `waste_records`
- `stock_count` — `stock_counts`
- `monthly_closing` — `monthly_closes`
- Checkout RPC (`003`): `inventory_deduction`, `payment_*`, `customer_discounts`, `tax`, `prevent_negative_stock`

## App-wired flags (v1)

These are editable in Settings and enforced in the app UI:

- `dark_mode` — theme toggle in shell header; forced light when disabled
- `barcode_scanner` — barcode scan field on POS
- `receipt_printing` — print receipt after successful checkout
- `cash_drawer` — hook after cash checkout (hardware integration point)

Wire additional hardware SDKs when deploying to physical registers.

## Default when flag missing

`is_feature_enabled()` returns `false` if the flag key is absent. Server actions use org defaults from [`DEFAULT_FEATURE_FLAGS`](../src/lib/constants.ts).

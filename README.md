# SweetFlow POS

A premium multi-location retail operations system for ice cream shops, cafés, and dessert stores. Built with Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, Supabase, and Zustand.

## Features

- **POS** — Touch-first selling with cart, payments, and customer attach
- **Inventory** — Per-store stock, purchases, transfers, waste, stock counts
- **Sessions** — Cashier shift open/close with cash reconciliation
- **Customers & Loyalty** — Profiles, order history, points earn/redeem
- **Reports** — Executive KPIs with Recharts dashboards
- **Online** — Public QR menu and first-party online orders
- **System** — Settings, users/roles, audit logs, XLSX import/export

> **Not live yet:** `/platform` UI (S02). Platform tables restored in S01 (`20260713133943`). Monthly closing was removed by cleanup. Souqna integrations (`030`/`031`) were dropped (ADR-009). See [docs/MASTER_ARCHITECTURE.md](docs/MASTER_ARCHITECTURE.md) and [docs/MIGRATION_AUDIT.md](docs/MIGRATION_AUDIT.md).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| State | Zustand (client) |
| Database | Supabase (PostgreSQL + RLS) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Export | SheetJS (xlsx) |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and fill in Supabase credentials
cp .env.example .env.local

# Local Supabase (optional)
supabase start
supabase db reset
npm run db:seed-auth

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production requires Supabase Auth and the environment variables in `.env.example`.

## Local dev credentials

After `supabase db reset` and `npm run db:seed-auth`, use the demo accounts. Full reference (Arabic + English): **[docs/DEMO_USERS.md](docs/DEMO_USERS.md)**.

Quick login: any seeded email below with password **`demo1234`** (from `scripts/seed-auth.mjs`).

| Email | Role |
|-------|------|
| `owner@CafeFlow.local` | owner |
| `manager@CafeFlow.local` | manager |
| `cashier1@CafeFlow.local` | cashier (POS PIN `1234`) |
| `cashier2@CafeFlow.local` | cashier (POS PIN `1234`) |
| `inventory@CafeFlow.local` | store keeper |

One-liner demo DB: `npm run db:reset-demo`

> **Note:** Product name is **Velora** (package: `cafeflow-erp-pos`). Tagline: نظام كاشير وإدارة فروع.

## Supabase Setup (Production)

1. Create a Supabase project and link the CLI: `supabase link`
2. Apply migrations in order (or `supabase db push`):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_production.sql`
   - `supabase/migrations/003_production_hardening.sql`
   - `supabase/migrations/004_app_settings_rls.sql`
   - `supabase/migrations/005_feature_flags_and_rls_roles.sql`
   - `supabase/migrations/006_fix_flags_and_org_rls.sql`
   - `supabase/migrations/007_apply_003_remaining.sql` (when `003` was partial on remote)
   - `supabase/migrations/008_recipes_and_costing.sql`
   - `supabase/migrations/009_inventory_cancelled_status.sql`
   - `supabase/migrations/011_accounting_centers_expenses.sql`
   - `supabase/migrations/012_online_menu_orders.sql`
   - `supabase/migrations/013_multi_warehouse_per_branch.sql`
   - `supabase/migrations/014_recipe_demo_seed.sql`
   - `supabase/migrations/015_full_rbac_permissions.sql`
   - `supabase/migrations/016_supplier_payments.sql`
   - `supabase/migrations/017_product_variants_recipes.sql`
   - `supabase/migrations/018_session_management.sql`
   - `supabase/migrations/019_device_delete_set_null.sql`
   - `supabase/migrations/020_online_menu_slug.sql`
   - `supabase/migrations/021_pos_device_access.sql`
   - `supabase/migrations/022_tenant_foundation.sql`
   - `supabase/migrations/023_customer_accounts.sql`
   - `supabase/migrations/025_p0_production_hardening.sql`
   - `supabase/migrations/026_checkout_wallet_credit.sql`
   - `supabase/migrations/027_split_payments.sql`
   - `supabase/migrations/028_expired_session_checkout_override.sql`
  - `supabase/migrations/029_purchase_landed_cost.sql`
  - …then **all later** numbered and timestamped migrations via `supabase db push` / `db reset`
3. Regenerate types: `npm run db:types` (after schema changes)

> **Migration net state:** `030`/`031` (Souqna) dropped by cleanup. `039` platform tables dropped by cleanup then **restored** by `20260713133943_*` (S01). `/platform` UI wired in S02 via `PLATFORM_BOOTSTRAP_EMAILS`. Details: [docs/MIGRATION_AUDIT.md](docs/MIGRATION_AUDIT.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

See [docs/PRODUCTION_PLAN.md](docs/PRODUCTION_PLAN.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), and [docs/FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md).
4. Set environment variables in `.env.local` (see `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SweetFlow_COOKIE_SECRET=your-long-random-secret
PLATFORM_BOOTSTRAP_EMAILS=admin@company.com
```

`PLATFORM_BOOTSTRAP_EMAILS` is server-only. Listed emails are upserted into `platform_admins` on first login to `/platform` (S02). Do **not** share the same list between staging and production.

**Do not** run `supabase/seed.sql` on a real production database. Use seed + `npm run db:seed-auth` only on local/demo environments.

## Project Structure

```
src/
├── app/(shell)/          # Sidebar layout routes
├── components/
│   ├── SweetFlow/        # Design system composites
│   └── ui/               # shadcn primitives
├── lib/
│   ├── auth/             # Session, guards, page access
│   ├── repositories/     # Supabase data access
│   └── supabase/         # Clients + generated types
├── modules/              # Feature modules (isolated)
│   ├── purchases/
│   ├── transfers/
│   ├── waste/
│   ├── stock-count/
│   ├── customers/
│   ├── loyalty/
│   ├── reports/
│   ├── online-orders/
│   └── system/
└── stores/               # Zustand client stores
```

## Deployment

Deploy to Vercel:

```bash
vercel
```

Set environment variables in the Vercel dashboard. `vercel.json` is included for Next.js defaults.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E (requires dev server + seed) |
| `scripts/dev-up.sh` | Reset Supabase, seed auth, start dev |
| `npm run db:reset` | Reset local DB (migrations + seed) |
| `npm run db:types` | Regenerate `database.types.ts` from local Supabase |
| `npm run db:seed-auth` | Link seed users to Supabase Auth accounts |
| `npm run db:push` | Push migrations to linked Supabase project |
| `npm run smoke:check` | Lint, typecheck, unit tests, build, env/migration sanity |

Manual QA: [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md)
Completion roadmap: [docs/COMPLETION_PLAN.md](docs/COMPLETION_PLAN.md)

## License

Private — SweetFlow POS

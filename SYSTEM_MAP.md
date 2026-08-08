# SYSTEM MAP / BAS-01

> Velora (GitHub `bassata-oms` · local `velora` · Vercel `velora`) — multi-location POS + light ERP for cafés, restaurants, and retail  
> Last updated: 2026-08-08

## Core / runtime

Next.js 16 App Router · React 19 · Supabase Auth/Postgres/RLS/Storage · SweetFlow / shadcn · Zustand · Zod · Vercel (hosting + cron)

## Modules

| ID | Name | Category | Entry points |
|----|------|----------|--------------|
| MOD / 01 | Auth & device unlock | ACCESS | `/login`, `/onboarding`, `/device/pair`, `/pos/start` |
| MOD / 02 | POS selling engine | SALES | `/pos`, `/api/pos/checkout` |
| MOD / 03 | Cashier sessions & vault | CASH | `/sessions`, `/sessions/[id]` |
| MOD / 04 | Kitchen display | FULFILLMENT | `/kitchen` |
| MOD / 05 | Orders & sales invoices | SALES | `/orders`, `/sales-invoices` |
| MOD / 06 | Online menu & orders | ONLINE | `/menu/[slug]`, `/online-orders`, `/track/[token]` |
| MOD / 07 | Catalog | CATALOG | `/products` |
| MOD / 08 | Inventory ops | INVENTORY | `/inventory/*` |
| MOD / 09 | Suppliers & AP | AP | `/inventory/suppliers` |
| MOD / 10 | Customers, loyalty, promos | CRM | `/customers`, `/promotions` |
| MOD / 11 | Expenses & general ledger | FINANCE | `/expenses`, `/accounting`, `/accounting/journals`, `/accounting/trial-balance`, `/accounting/ledger`, `/accounting/income-statement`, `/accounting/balance-sheet` |
| MOD / 12 | Reports & monthly closing | INSIGHTS | `/reports`, `/monthly-closing`, `/labels` |
| MOD / 13 | Tenant admin | ADMIN | `/settings`, `/devices`, `/audit` |
| MOD / 14 | Platform control plane | SAAS | `/platform`, `/platform/usage`, `/platform/menu-themes`, `/platform/invites`, `/platform/audit`, `/platform/users`, `/platform/devices`, `/platform/sessions`, `/platform/ops`, `/platform/marketing`, `/platform/orgs/[id]` |

## Primary path

```
CORE / RUNTIME
      ↓
MOD / 01 Auth & device  →  pair + open session
      ↓
MOD / 02 POS checkout  →  order + payment RPC
      ↓
MOD / 08 Inventory  →  stock deduction
      ↓
MOD / 03 Close session
      ↓
MOD / 12 Daily-close / reports
```

## Counts

| Roles | Modules | Integrations |
|------:|--------:|-------------:|
| 5 | 14 | 5 primary |

## Roles

| Role | Scope |
|------|--------|
| `owner` | Full org (bypasses permission checks) |
| `manager` | Branch ops, sessions, reports |
| `cashier` | POS + limited session; store/device scoped |
| `inventory` | Purchases / stock / transfers / counts |
| `platform_admin` | SaaS control plane |

## Integrations

| System | Status |
|--------|--------|
| Supabase | Live — auth, DB, RLS, storage |
| Vercel | Live — hosting + cron |
| Resend | Live — transactional email |
| First-party QR menu / online orders | Live |
| Custom domains | Pilot-ready |
| USB serial scale | Stub |
| Stripe / SaaS billing | Planned (after hardware pilot + manual SaaS ops) |
| Manual plan limits / suspend | Live — platform plan + `assertPlatformCapacity` + suspend (incl. non-payment) |
| Menu theme catalog / entitlements | Live — platform prices + per-org enable; store save enforced |
| Tenant full data export | Live — platform org detail JSON dump (bounded, audited) |
| External GL sync | Planned |

## Secondary flows

- QR menu → online order → staff fulfill → track token
- Purchase receive → stock in → supplier payment → AP statement
- POS customer attach → credit / loyalty → aging → receive payment
- Platform invite/suspend org → onboarding → optional custom domain

## Map maintenance

Update this file when modules, primary path, roles, or integration status change. See global Cursor rule `system-map`.

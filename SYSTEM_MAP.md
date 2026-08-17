# SYSTEM MAP / BAS-01

> Velora (GitHub `velora` · local `velora` · Vercel `velora`) — multi-location POS + light ERP for cafés, restaurants, and retail  
> Last updated: 2026-08-17 (GL expense mapping + cash over/short + org CoA openings; HQ treasuries)

## Core / runtime

Next.js 16 App Router · React 19 · Supabase Auth/Postgres/RLS/Storage · Velora UI kit / shadcn · Zustand · Zod · Vercel (hosting + cron)

## Modules

| ID | Name | Category | Entry points |
|----|------|----------|--------------|
| MOD / 01 | Auth & device unlock | ACCESS | `/login`, `/onboarding`, `/device/pair`, `/pos/start` |
| MOD / 02 | POS selling engine | SALES | `/operations` (hub), `/pos`, `/api/pos/checkout` |
| MOD / 03 | Cashier sessions & vault | CASH | `/sessions` (KPIs + variance chart + report links), `/sessions/[id]`, `/treasury` (HQ + branch cash treasuries + ledger) |
| MOD / 04 | Kitchen display | FULFILLMENT | `/kitchen` (queue glance; no prep-timing events yet) |
| MOD / 05 | Orders & sales documents | SALES | `/orders`, `/sales-documents` (hub), `/quotations`, `/sales-orders`, `/sales-invoices`, `/credit-notes` |
| MOD / 06 | Online menu & orders | ONLINE | `/menu/[slug]`, `/online-orders` (status/AOV/menu-source glance), `/track/[token]`, `/settings?tab=branches` (brand typography + OG + menu opens → orders) |
| MOD / 07 | Catalog | CATALOG | `/catalog` (hub), `/products`, `/labels` |
| MOD / 08 | Inventory ops | INVENTORY | `/inventory` (hub KPIs/chart), `/inventory/purchases`, `/inventory/purchase-requests`, `/inventory/purchase-orders`, `/inventory/purchase-returns`, `/inventory/containers` (flag `purchase_imports`), `/inventory/customs-certificates` (flag `purchase_imports`), `/inventory/transfers`, `/inventory/waste`, `/inventory/stock-count`, `/print/stock-count` |
| MOD / 09 | Suppliers & AP | AP | `/purchasing` (hub), `/inventory/suppliers` (KPIs + aging chart + links) |
| MOD / 10 | Customers, loyalty, promos | CRM | `/customers` (hub), `/customers/directory`, `/customers/loyalty`, `/promotions` |
| MOD / 11 | Expenses & general ledger | FINANCE | `/expenses` (category/month glance), `/accounting` (hub), `/accounting/accounts` (Excel CoA import + org-level opening JE), `/accounting/journals` (retry failed auto-posts), `/accounting/trial-balance`, `/accounting/ledger`, `/accounting/income-statement`, `/accounting/balance-sheet` |
| MOD / 12 | Reports & monthly closing | INSIGHTS | `/reports`, `/reports/sales` (+ product/branch/cashier mini), `/reports/product-card` ↔ sales product, `/reports/aging`, `/reports/statement`, `/monthly-closing`, `/labels` |
| MOD / 13 | Tenant admin | ADMIN | `/admin` (hub), `/settings` (incl. print templates), `/devices` (activity glance), `/audit` |
| MOD / 14 | Platform control plane | SAAS | `/platform` (org health glance + charts), `/platform/usage` (plan/pressure glance), `/platform/menu-themes`, `/platform/invites`, `/platform/audit`, `/platform/users`, `/platform/devices`, `/platform/sessions`, `/platform/ops`, `/platform/marketing`, `/platform/orgs/[id]` |

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
- Public menu opens attributed by `?src=` (qr/whatsapp/…) → branch settings stats
- Store brand typography + OG (`stores.settings.brand`) → public menu tokens + share card (`brand-product-order`)
- Purchase receive → stock in → supplier payment → AP statement
- Quotation → sales order → sales invoice (deliver/stock) → optional credit note; or import sent quotation / confirmed SO into draft SI (edit qty/price) / convert quote → invoice directly
- Purchase request → purchase order → partial purchase invoices → optional purchase return; or import sent/partial PO remaining lines into draft PI (edit cost before receive)
- Optional import path (flag `purchase_imports`, manual only — not activity preset): PO in USD → containers → customs certificate costs → receive container to warehouse → adjust landed cost
- Settings print templates (`print_engine` at `/settings?tab=print`) → named A4 templates, layouts, block order, per-kind assignment; POS A4; delivery note (`?variant=delivery`); PO/PR/quotation/SO print without prices (`?hidePrices=1`)
- Stock count → scan barcode (+1) → approval → post variance; print sheet by store/warehouse/category/product (`/inventory/stock-count`)
- POS customer attach → credit / loyalty → aging → receive payment
- Reports → مديونية العملاء/الموردين (`/reports/aging`) → كشف حساب (`/reports/statement` or party detail)
- Reports → مبيعات (`/reports/sales`) → مصغّر منتج/فرع/موظف
- Inventory hub → glance حركات + روابط كارت صنف / مبيعات منتج / إعادة طلب؛ مشتريات/تحويلات/هالك بـ KPIs سريعة
- Customers / suppliers → glance مديونية + تحصيل/سداد 30 يوم + chart أعمار + روابط aging/statement
- Sessions → glance فروقات/إيراد مفتوح + روابط تقرير الجلسات / الكاشير / الإقفال اليومي
- Online orders → glance حالات + AOV + مصادر فتح المنيو؛ رابط من إعدادات الفرع
- Expenses / accounting → glance مصروفات حسب تصنيف/شهر + روابط PnL وميزان وقائمة دخل (الدفاتر مصدر الحقيقة)
- Cash treasuries → خزينة رئيسية + خزينة فرع + سجل حركات؛ توريد من أمانة الكاشير؛ سحب فترة مقفولة؛ صرف/تحصيل نقدي مربوط بخزينة (`/treasury`)
- Kitchen → backlog/أقدم طلب من الطابور الحالي (بدون متوسط تحضير لحد ما تتوفر أحداث زمن)
- Devices → نشط / last_seen 24س من قائمة الأجهزة
- Platform → glance صحة الشركات + شركات هادئة 30 يوم + توزيع الباقات/الضغط في `/platform/usage` (بدون MRR؛ Stripe Planned)
- Platform invite/suspend org → onboarding → optional custom domain
- ⌘K / Ctrl+K jumps to every operator screen the product shows: sidebar, reports hub cards, settings tabs, movements/price-list/account extras; platform admin uses the same shortcut over `PLATFORM_NAV_GROUPS`
- Module hubs: `/operations`, `/sales-documents`, `/customers`, `/catalog`, `/purchasing`, `/accounting`, `/admin` — each board shows live KPIs + chart then navigation cards (+ existing rich `/inventory`, `/reports`, `/`)

## Map maintenance

Update this file when modules, primary path, roles, or integration status change. See global Cursor rule `system-map`.

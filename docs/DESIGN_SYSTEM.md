# SweetFlow Design System

Shared UI primitives live in [`src/components/SweetFlow/`](../src/components/SweetFlow/). Use them for consistent retail operations UX.

## Primitives

| Component | Use |
|-----------|-----|
| `page-header` | Page title + description |
| `kpi-card` | Metric tiles (dashboard, reports) |
| `operational-card` | Section panels with title |
| `confirm-action-dialog` | Destructive confirmations |
| `access-denied` | RBAC denial states |
| `status-pill` | Order/session status chips |
| `pos-readiness-status` | POS gate messaging |

## Layout patterns

- **Shell:** sidebar nav + header with store selector (`app-shell`)
- **Operational (POS):** full viewport, touch-first controls (`min-h-28` payment tiles)
- **Settings:** tabbed Shopify-style sections (`settings-shell`)

## Typography & density

- Headings: `font-semibold tracking-tight`
- Money: `tabular-nums` + `formatCurrency`
- POS: large tap targets, `rounded-2xl` cards, minimal chrome

## Forms & tables

- Use shadcn `Button`, `Input`, `Select`, `Dialog` from `@/components/ui`
- **Select:** same footprint as `Input` (`h-9` / `w-full`). Narrow filters/header use an explicit width override (`w-48`, `w-[180px]`, …).
- **Select items with secondary value** (balance, code, unit): use `SelectItemMeta` — never concatenate with ` · ` in one string. Keep `label` as the trigger label; meta shows in the list only.
- Tables: sticky header on wide reports; zebra via `border-border/40` row dividers

## Mobile / tablet

- POS cart opens in `Sheet` below `xl` breakpoint
- Dashboard grids: `sm:grid-cols-2 lg:grid-cols-4`
- Test primary flows at 768px and 1024px widths

## Inspiration map

| Surface | Reference |
|---------|-----------|
| Dashboard | Stripe / Linear — KPI row + sparkline |
| POS | Square / Toast — category rail + cart sheet |
| Inventory | Lightspeed — dense tables, filter chips |
| Settings | Shopify — left tabs, section cards |
| Reports | Executive summary KPIs above charts |

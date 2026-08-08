# Velora Design System

Shared UI primitives live in [`src/components/Velora/`](../src/components/Velora/). Use them for consistent retail operations UX.

## Primitives

| Component | Use |
|-----------|-----|
| `page-header` | Page title + description |
| `kpi-card` | Metric tiles (dashboard, reports) |
| `operational-card` | Section panels with title |
| `confirm-action-dialog` | Destructive confirmations |
| `standard-modal` (`StandardModalContent`) | Form / ops dialogs — title, body, Cancel→Confirm footer |
| `responsive-list-layout` | Dual layout: cards `<md`, table/desktop `≥md` |
| `mobile-entity-card` | Touch list card for use with `ResponsiveListLayout` |
| `data-table-shell` | Table toolbar (search, actions) + overflow shell |
| `state-blocks` | `EmptyStateBlock` / `LoadingStateBlock` / `ErrorStateBlock` |
| `form-field` (`FormField`) | Labeled form field wrapper |
| `access-denied` | RBAC denial states |
| `status-pill` | Order/session status chips |
| `pos-readiness-status` | POS gate messaging |

## Layout patterns

- **Shell:** sidebar nav + header with store selector (`app-shell`); bottom tabs + More sheet on `<md`
- **Operational (POS):** full viewport, touch-first controls (`min-h-28` payment tiles)
- **Settings:** search + section picker — Select on `<md`, horizontal tabs from `md` (`settings-shell`)

## Typography & density

- Headings: `font-semibold tracking-tight`
- Money: `tabular-nums` + `formatCurrency`
- POS: large tap targets, `rounded-2xl` cards, minimal chrome

## Forms & tables

- Use shadcn `Button`, `Input`, `Select`, `Dialog` from `@/components/ui`
- Prefer `StandardModalContent` over raw `DialogContent` for ops forms
- **DialogFooter:** equal-width actions by default (`flex-1` children). Put Cancel then Confirm in the DOM; RTL places them correctly. Prefer `h-11`/`h-12` + `rounded-xl` on footer buttons. For `DialogContent` with `p-0`, override footer with `mx-0 mb-0`.
- **Select:** same footprint as `Input` (`h-9` / `w-full`). Narrow filters/header use an explicit width override (`w-48`, `w-[180px]`, …).
- **Select items with secondary value** (balance, code, unit): use `SelectItemMeta` — never concatenate with ` · ` in one string. Keep `label` as the trigger label; meta shows in the list only.
- Tables: sticky header on wide reports; zebra via `border-border/40` row dividers
- Actionable lists: wrap with `ResponsiveListLayout` + `MobileEntityCard` — do not invent page-owned card chrome

## Mobile / tablet

- POS cart opens in `Sheet` below `lg` breakpoint
- Dashboard grids: `sm:grid-cols-2 lg:grid-cols-4`
- Touch targets for repeated ops: ~44px (`h-11` / `size-11`)
- Test primary flows at 375px, 768px, and 1024px widths

## Inspiration map

| Surface | Reference |
|---------|-----------|
| Dashboard | Stripe / Linear — KPI row + sparkline |
| POS | Square / Toast — category rail + cart sheet |
| Inventory | Lightspeed — dense tables, filter chips |
| Settings | Shopify — section cards; mobile section Select |
| Reports | Executive summary KPIs above charts |

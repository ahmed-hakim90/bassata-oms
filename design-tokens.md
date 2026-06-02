# SweetFlow Design Tokens

## Colors
- `--color-primary`: Primary brand and active actions
- `--color-background`: App background
- `--color-card`: Surface for cards, forms, tables
- `--color-muted`: Secondary surface and muted rows
- `--color-destructive`: Errors and destructive states
- Usage rule: keep contrast minimum WCAG AA for text and controls

## Spacing
- `4px` (`space-1`): micro spacing between icon and text
- `8px` (`space-2`): compact form/control spacing
- `12px` (`space-3`): default row spacing
- `16px` (`space-4`): card inner padding baseline
- `24px` (`space-6`): section spacing
- `32px` (`space-8`): page-block spacing

## Radius
- `--radius-button`: buttons and inline controls
- `12px` (`rounded-xl`): default card/form container
- `16px` (`rounded-2xl`): primary panels and shell surfaces
- `24px` (`rounded-3xl`): auth and hero blocks

## Typography
- Page title: `text-2xl` + `font-semibold`
- Section title: `text-base` + `font-semibold`
- Body: `text-sm`
- Meta/help text: `text-xs` + `text-muted-foreground`
- Numeric KPI values: `tabular-nums`

## Elevation
- Base card: border + subtle background (`border-border/60`)
- Interactive card: add soft shadow (`shadow-sm`)
- Floating surfaces (dialogs/nav): backdrop blur + elevated border
- Avoid heavy ERP-style dense shadows

## Component Consistency Rules
- Modals: shared structure, `sm|md|lg|xl` sizes, cancel left / primary right
- Forms: consistent label spacing, input heights, error/hint placement
- Tables: shared shell, shared header density, explicit empty/loading/error states
- Empty states: concise sentence + optional primary CTA

## Responsive Rules
- Never rely on horizontal scrolling for core task completion on tablet
- Convert dense data tables to card summaries on small screens where practical
- Keep action buttons >= 40px touch target in cashier flows

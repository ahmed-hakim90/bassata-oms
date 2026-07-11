# Performance Budget

UI latency targets for SweetFlow operator surfaces. These are **product requirements**, not stretch goals.

Measure on a mid-tier laptop / tablet on local or staging with a warm cache unless noted. Prefer Chrome Performance / `performance.now()` around the interaction.

## Targets

| Interaction | Budget | Notes |
|-------------|--------|--------|
| Shell page open (route transition to usable content) | **&lt; 1s** | First meaningful paint of header + primary content; excludes cold SSR first visit if documented |
| POS product search (filter already-loaded catalog) | **&lt; 150ms** | Keystroke → filtered tiles visible |
| Add product to cart | **&lt; 100ms** | Tap → cart line + totals update |
| Open drawer / sheet (cart, filters, detail) | **&lt; 200ms** | Gesture → interactive |
| Receipt print start (browser or USB handoff) | **&lt; 2s** | Click print → print dialog or device job accepted |

## How to measure

1. **Page open:** mark navigation start → when `PageHeader`/POS chrome + main region are interactive (no full-page skeleton).
2. **Search / cart:** wrap handler with `performance.now()` in temporary dev logging; remove before release or gate behind `NODE_ENV === "development"`.
3. **Drawer:** measure from open trigger to focus trapped inside sheet.
4. **Print:** measure from print CTA to `window.print` / USB send resolve.

## Non-goals (Phase 0)

- Full Lighthouse CI gates (add in Stabilization if needed)
- Offline cache timing
- Server action round-trip budgets (track separately; UI must still show pending state immediately)

## Failure policy

If a change regresses a budget:

1. Do not merge as “done” for that screen’s acceptance criteria
2. Prefer reducing work on main thread (list virtualization, defer non-critical widgets) over decorative motion
3. Record known exceptions in the screen’s acceptance notes with owner + date

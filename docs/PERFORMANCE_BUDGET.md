# Performance Budget

UI latency targets for SweetFlow operator surfaces. These are **product requirements**, not stretch goals.

Measure on a mid-tier laptop / tablet on local or staging with a warm cache unless noted. Prefer Chrome Performance / `performance.now()` around the interaction.

## Targets

| Interaction | Budget | Notes |
|-------------|--------|--------|
| Shell page open (route transition to usable content) | **&lt; 1s** | First meaningful paint of header + primary content; excludes cold SSR first visit if documented |
| Module glance (customers / suppliers / sessions / inventory / module hubs) | **&lt; 1s** | Batch SQL (chunked `.in`) — no N+1 ledgers; prefer aggregates from already-loaded rows |
| POS product search (filter already-loaded catalog) | **&lt; 150ms** | Keystroke → filtered tiles visible |
| Add product to cart | **&lt; 100ms** | Tap → cart line + totals update |
| Open drawer / sheet (cart, filters, detail) | **&lt; 200ms** | Gesture → interactive |
| Receipt print start (browser or USB handoff) | **&lt; 2s** | Click print → print dialog or device job accepted |
| POS checkout UI unlock (cart clear / next sale) | **&lt; 100ms** | Confirm pay → cart free for next customer; server save continues in background |
| Purchase receive UI unlock | **&lt; 100ms** | Confirm receive → return to list; stock RPC runs in background |
| Purchase receive server (atomic RPC) | **≤ 1s** | Typical invoice (~30 lines), warm DB; one `receive_purchase_invoice` round-trip |

## Data loading rules (glance / reports)

- Prefer **one query (or chunked `.in`)** over per-row / per-party fetches.
- AR aging: `listCreditSaleDebitsForCustomers` (batch) — not `listCustomerLedger` in a loop.
- AP aging: `listReceivedPurchasesForAging` + `listPaymentsForStores` — not per-store loops.
- Session report: filter `opened_at` in SQL via `listSessions(..., { openedSince })`.
- Session board glance: aggregate from rows already loaded for the page — no second round-trip.
- Online orders glance: status/AOV from loaded orders + one `get_online_menu_view_stats` RPC (not per-order).
- Expenses glance: aggregate from the filtered list already loaded for `/expenses` — no second sum query.
- Kitchen glance: from loaded queue tickets only; do not invent prep duration without KDS timing events.
- Devices glance: from `listDevices()` already loaded for `/devices`.
- Module hubs: KPIs/charts from existing domain loaders (live sales, documents, inventory summary, purchases/suppliers, customers aging, GL overview, devices) — fail-soft per hub; no demo KPIs.
- Platform org glance: from `listOrganizationHealthSummaries()` + pending invite count already loaded for `/platform` — no billing invent.
- Platform usage glance: from `listPlatformUsageMatrix()` rows already loaded for `/platform/usage`.

## How to measure

1. **Page open:** mark navigation start → when `PageHeader`/POS chrome + main region are interactive (no full-page skeleton).
2. **Search / cart:** wrap handler with `performance.now()` in temporary dev logging; remove before release or gate behind `NODE_ENV === "development"`.
3. **Drawer:** measure from open trigger to focus trapped inside sheet.
4. **Print:** measure from print CTA to `window.print` / USB send resolve.

## Non-goals (Phase 0)

- Full Lighthouse CI gates (add in Stabilization if needed)
- Offline cache timing
- Full end-to-end network budgets on cold connections (track separately; UI must unlock immediately and show background pending)

## Failure policy

If a change regresses a budget:

1. Do not merge as “done” for that screen’s acceptance criteria
2. Prefer reducing work on main thread (list virtualization, defer non-critical widgets) over decorative motion
3. Record known exceptions in the screen’s acceptance notes with owner + date

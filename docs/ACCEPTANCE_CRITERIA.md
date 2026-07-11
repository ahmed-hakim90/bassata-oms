# Acceptance Criteria

Definition of done for operator screens. A screen is **finished** only when every applicable row below passes.

## Screen template

Copy per screen or screen group:

```md
### Screen: <route> — <name>

**Finished when**
- [ ] Page answers: where am I / what needs attention / next action (≤3s scan)
- [ ] Uses SweetFlow shell primitives (`PageHeader` or POS chrome, not ad-hoc titles)
- [ ] Empty / Loading / Error use `state-blocks` (or POS-equivalent with same semantics)
- [ ] Primary action is obvious; destructive actions confirm
- [ ] Responsive at 768 / 1024 / 1280
- [ ] Keyboard: focus order sane; shortcuts documented if any
- [ ] RTL Arabic copy clear; no fake demo KPIs
- [ ] Happy paths below pass
- [ ] Edge paths below pass
- [ ] Performance budgets in PERFORMANCE_BUDGET.md met for this surface
- [ ] Error contracts in ERROR_BUDGET.md covered for mutations on this screen
```

### Happy paths (fill per screen)

1. …
2. …

### Edge paths (fill per screen)

1. …
2. …

### Must test

- [ ] …
- [ ] …

---

## Shell chrome

**Routes / surfaces:** app shell, sidebar, header, mobile nav, session bar, command palette

**Finished when**

- [ ] Nav items match role + permissions + feature flags
- [ ] Active store visible and switchable when multi-store
- [ ] Session bar reflects open session or clear CTA to open
- [ ] Command palette opens via documented shortcut and navigates correctly
- [ ] Mobile nav usable at 768px without overlapping primary content permanently
- [ ] Access denied uses `AccessDenied`, never blank page

**Happy paths**

1. Owner lands on dashboard with full nav
2. Cashier redirected to POS (not admin dashboard)
3. Switch store → scoped data refreshes

**Edge paths**

1. Missing permission → AccessDenied
2. Feature flag off → nav item hidden / action blocked
3. No open session → session bar messaging clear

**Must test:** role matrix owner / manager / cashier / inventory; mobile + desktop.

---

## POS (`/pos`)

**Finished when**

- [ ] Pairing / readiness gates explain *why* blocked and *how* to fix
- [ ] Catalog: categories, search, tiles; empty catalog state
- [ ] Cart: add/update/remove; empty cart state; touch targets adequate
- [ ] Checkout: cash / card / wallet / split / credit (if flag) with clear totals
- [ ] Hold/park, discounts + manager override where required
- [ ] Receipt success + print path; print failure surfaced (see ERROR_BUDGET)
- [ ] Session expired / network failure messaging (ERROR_BUDGET)

**Happy paths**

1. Open session → sell cash → print/skip receipt → continue
2. Split payment completes with correct tender total
3. Hold order → resume → complete

**Edge paths**

1. Expired session + manager override (if enabled)
2. Offline / failed checkout → order not silently marked paid
3. Printer disconnected → sale still succeeds; print error shown

**Must test:** touch width ~1024; barcode search if scanner present; Arabic RTL.

---

## Ops group (dashboard, sessions, orders, expenses)

**Finished when** each page uses PageHeader (or equivalent), state-blocks, one primary action, filters/search where lists exist, and row actions are reachable on mobile.

**Happy paths (minimum)**

1. Dashboard loads live widgets without placeholder KPIs
2. Sessions: open list → close stepper completes
3. Orders: list → detail → refund path visible if permitted
4. Expenses: filter → create via wizard → appears in list

**Edge paths**

1. Empty lists show EmptyStateBlock + CTA
2. Load failure shows ErrorStateBlock
3. Close session with cash variance requires acknowledgment

---

## Inventory & catalog group

**Finished when** hub and child flows (purchases, transfers, stock-count, waste, suppliers, products) share the same shell/state patterns; mutations confirm when destructive.

**Happy paths (minimum)**

1. Create/edit product with variants/recipe as configured
2. Purchase receive updates stock
3. Transfer draft → ship/receive
4. Stock count post (or explicit pending state)
5. Waste record posts

**Edge paths**

1. Insufficient permission
2. Empty warehouse / no products
3. Failed mutation surfaces ErrorStateBlock or toast + recoverable form state

# Error Budget

Contracts for failure UX. Every critical mutation must declare what the operator sees and whether data is safe.

## Global rules

1. Never mark a sale/payment successful if the server did not confirm.
2. Never hide errors behind empty screens — use `ErrorStateBlock`, toast, or inline alert.
3. Preserve entered form/cart data when recoverable.
4. Prefer Arabic operator copy that states **what failed** and **what to do next**.

## Scenarios

### Network disconnected / request failed

| Surface | Expected UX |
|---------|-------------|
| POS checkout | Block success dialog; show retryable error; cart retained |
| Shell mutations (save product, expense, etc.) | Toast or inline error; form values retained |
| List fetch | `ErrorStateBlock` with retry if available, else refresh guidance |
| Public QR menu | Friendly offline/error message; no auth leak |

### Session expired (cashier / POS session)

| Case | Expected UX |
|------|-------------|
| Soft warning before expiry | Session bar / banner with time remaining if product supports it |
| Checkout while expired | Block sale; explain; offer manager override **only** if feature + permission allow |
| After force-close | Cannot sell until new session opened |

### Order / checkout save failed

| Case | Expected UX |
|------|-------------|
| RPC / validation error | Map server message to readable Arabic; stay on payment step |
| Partial client state | Do not clear cart on failure |
| Duplicate submit | Disable primary CTA while pending; idempotent server handling where exists |

### Receipt printer disconnected / print failed

| Case | Expected UX |
|------|-------------|
| USB / browser print fails | Sale remains successful if already committed; show print error + “retry print” |
| No printer configured | Allow skip; do not block next sale |
| Reprint from order detail | Same error surfacing |

### Device pairing / readiness

| Case | Expected UX |
|------|-------------|
| Unpaired register | Readiness banner explains pair steps; no silent empty POS |
| Wrong store device | Clear mismatch message |

### Auth / permission

| Case | Expected UX |
|------|-------------|
| Missing permission | `AccessDenied` |
| Auth cookie expired | Redirect to login with return path when safe |

## Must cover before Pilot (POS day flow)

- [ ] Checkout network failure
- [ ] Expired session sale attempt
- [ ] Print failure after successful sale
- [ ] Unpaired device gate

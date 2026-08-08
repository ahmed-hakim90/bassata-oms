# Device Matrix — hardware pilot

Target hardware for Velora POS and shell. **Commercial track step 1:** validate Required rows on real store devices before live Pilot week.

Record outcomes in [results/hardware-pilot-results.md](./results/hardware-pilot-results.md), then update Status below (Untested → Pass / Fail).

| Device / peripheral | Priority | Target use | Status |
|---------------------|----------|------------|--------|
| Windows 10/11 laptop or POS PC (Chrome/Edge) | Required | Admin shell + POS | **Untested** |
| macOS (Chrome/Safari) | Required | Admin / owner ops | **Partial** — local dev only |
| Android tablet (Chrome) | Required | POS touch | **Untested** |
| iPad (Safari/Chrome) | Best-effort | POS touch if deployed | Not committed for MVP — **Untested** |
| Touch screen (≥10″) | Required | POS tiles, payment, cart sheet | **Untested** |
| Barcode scanner (HID keyboard wedge) | Required if SKUs scanned | Focus search + scan-to-add | **Untested** |
| Receipt printer (USB / browser print) | Required for pilot store | POS receipt + `(print)` routes | **Partial** — code path only |
| Cash drawer (kick via printer ESC/POS) | Required if cash sales | Open drawer on cash sale / manager override | **Untested** |

## Day-0 hardware script (≈2–4h)

Prerequisites: production or staging org (no demo passwords), one store, owner + cashier, `receipt_printing` on if printer present.

1. **Admin machine** — owner login → Settings → Devices → create/pair register.
2. **POS device** — open `/pos` (or pair URL) → confirm readiness banner clear.
3. **Session** — cashier open session with float.
4. **Sale** — 1–2 cash items → pay → print receipt (or confirm skip path).
5. **Print resilience** — cancel/fail print once → retry from success/order path; sale must stay committed.
6. **Touch** — add/remove/qty/pay without keyboard.
7. **Optional** — barcode scan; drawer kick on cash; manager override discount.
8. **Close** — close session; manager understands variance.
9. **Refund** — one refund path; stock/session still coherent.
10. **Sign** — fill [hardware-pilot-results.md](./results/hardware-pilot-results.md); triage P0 only before live week.

## Breakpoints to verify

| Width | Expectation | Status |
|-------|-------------|--------|
| 768px | Mobile nav; POS cart in sheet; readable lists | Untested formal pass |
| 1024px | Tablet POS / dense tables usable | Untested formal pass |
| 1280px+ | Full sidebar + multi-column ops | Dev observation only |

## Per-device smoke (copy per unit)

- [ ] Login + role landing
- [ ] Open session → cash sale → receipt
- [ ] Cart add/remove under touch
- [ ] Scan barcode (if applicable)
- [ ] Print failure recoverable
- [ ] Close session

See also [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md) · [results/S16-smoke-results.md](./results/S16-smoke-results.md).

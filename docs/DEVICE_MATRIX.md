# Device Matrix — S16 status (2026-07-13)

Target hardware for SweetFlow POS and shell. Pilot must validate **Required** rows on real devices.

| Device / peripheral | Priority | Target use | Status (S16) |
|---------------------|----------|------------|--------------|
| Windows 10/11 laptop or POS PC (Chrome/Edge) | Required | Admin shell + POS | **Untested** — no Windows pilot device in this session |
| macOS (Chrome/Safari) | Required | Admin / owner ops | **Partial** — primary local dev (Chrome); not a formal pilot pass checklist |
| Android tablet (Chrome) | Required | POS touch | **Untested** |
| iPad (Safari/Chrome) | Best-effort | POS touch if deployed | Not committed for MVP — **Untested** |
| Touch screen (≥10″) | Required | POS tiles, payment, cart sheet | **Untested** on real ≥10″ touch hardware |
| Barcode scanner (HID keyboard wedge) | Required if SKUs scanned | Focus search + scan-to-add | **Untested** |
| Receipt printer (USB / browser print) | Required for pilot store | POS receipt + `(print)` routes | **Partial** — print routes exist in code; no store printer proof |
| Cash drawer (kick via printer ESC/POS) | Required if cash sales | Open drawer on cash sale / manager override | **Untested** |

## Breakpoints to verify

| Width | Expectation | S16 |
|-------|-------------|-----|
| 768px | Mobile nav; POS cart in sheet; readable lists | Untested formal pass |
| 1024px | Tablet POS / dense tables usable | Untested formal pass |
| 1280px+ | Full sidebar + multi-column ops | Dev observation only — not signed |

## Pilot checklist (per device)

- [ ] Login + role landing
- [ ] Open session → cash sale → receipt
- [ ] Cart add/remove under touch
- [ ] Scan barcode (if applicable)
- [ ] Print failure recoverable
- [ ] Close session

**S16:** None of the above checked on Required real devices. Record results (device model, browser, date, pass/fail) during pilot hardware day — then update this table from Untested → Pass/Fail.

See also [docs/results/S16-smoke-results.md](./results/S16-smoke-results.md).

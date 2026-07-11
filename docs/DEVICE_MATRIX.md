# Device Matrix

Target hardware for SweetFlow POS and shell. Pilot must validate **Required** rows on real devices.

| Device / peripheral | Priority | Target use | Status |
|---------------------|----------|------------|--------|
| Windows 10/11 laptop or POS PC (Chrome/Edge) | Required | Admin shell + POS | Untested until Pilot |
| macOS (Chrome/Safari) | Required | Admin / owner ops | Dev primary |
| Android tablet (Chrome) | Required | POS touch | Untested until Pilot |
| iPad (Safari/Chrome) | Best-effort | POS touch if deployed | Not committed for MVP |
| Touch screen (≥10″) | Required | POS tiles, payment, cart sheet | Validate hit targets ≥44px |
| Barcode scanner (HID keyboard wedge) | Required if SKUs scanned | Focus search + scan-to-add | Untested until Pilot |
| Receipt printer (USB / browser print) | Required for pilot store | POS receipt + `(print)` routes | Partial (code paths exist) |
| Cash drawer (kick via printer ESC/POS) | Required if cash sales | Open drawer on cash sale / manager override | Validate with store hardware |

## Breakpoints to verify

| Width | Expectation |
|-------|-------------|
| 768px | Mobile nav; POS cart in sheet; readable lists |
| 1024px | Tablet POS / dense tables usable |
| 1280px+ | Full sidebar + multi-column ops |

## Pilot checklist (per device)

- [ ] Login + role landing
- [ ] Open session → cash sale → receipt
- [ ] Cart add/remove under touch
- [ ] Scan barcode (if applicable)
- [ ] Print failure recoverable
- [ ] Close session

Record results (device model, browser, date, pass/fail) in the pilot notes after Phase 4 starts.

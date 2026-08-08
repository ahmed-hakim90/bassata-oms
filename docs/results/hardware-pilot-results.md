# Hardware Pilot Results

**Store / org:**  
**Date:**  
**Operator:**  
**App URL:**  
**Browser:**  

Fill during the hardware day. Update [DEVICE_MATRIX.md](../DEVICE_MATRIX.md) Status column when done (Untested → Pass / Fail).

## Devices under test

| Device | Model / OS | Browser | Pass / Fail | Notes |
|--------|------------|---------|-------------|-------|
| POS PC / laptop | | | | |
| Android tablet | | | | |
| Touch screen ≥10″ | | | | |
| Receipt printer | | | | |
| Cash drawer | | | | |
| Barcode scanner | | | | |

## Flow checklist

| # | Step | Pass / Fail | Evidence (order # / screenshot) |
|---|------|-------------|----------------------------------|
| 1 | Owner login → Settings | | |
| 2 | Pair register (code or register browser) | | |
| 3 | Cashier login / PIN switch | | |
| 4 | Open session | | |
| 5 | Cash sale → receipt print | | |
| 6 | Print fail recoverable (unplug / cancel) + retry | | |
| 7 | Touch: add / remove / pay | | |
| 8 | Barcode scan-to-add (if used) | | |
| 9 | Drawer kick on cash (if used) | | |
| 10 | Close session + variance understood | | |
| 11 | Refund path (manager) | | |
| 12 | Offline network blip: sale fails safely (no double charge) | | |

## P0 / P1 found

```text
Severity:
Device:
Steps:
Expected:
Actual:
```

## Sign-off

- [ ] No open P0 after hardware day
- [ ] Cashiers can sell + close without developer
- [ ] DEVICE_MATRIX Required rows updated
- [ ] Ready for 3–7 day live pilot ([PILOT_RUNBOOK.md](../PILOT_RUNBOOK.md))

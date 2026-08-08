# AR + Pharmacy UX (Top-5 P4/P5)

**Date:** 2026-08-08

## AR collect / aging

- Aging report customers table: **تحصيل** → `/customers/{id}?collect=1`
- Customer detail opens `RecordCustomerPaymentDialog` when `collect=1` and balance > 0 (same dialog as header action — single implementation)
- Credit limit deny copy explains remaining capacity and next step (collect / raise limit)
- Checkout RPC `Credit limit exceeded` mapped to the same Arabic guidance

## Pharmacy expiry

- Checkout maps `Expired batch stock exists` → clear Arabic block message for cashiers
- Pharmacy preset keeps `block_sale` + FEFO + batch tracking
- PosSetupGuide pharmacy steps reinforce batches + blocked expired sale

## Manual smoke (operator)

1. Customer with credit limit → credit sale over limit → deny with remaining amount  
2. Aging → تحصيل → payment → balance drops  
3. Pharmacy product with expired batch + prevent_negative_stock → sale blocked with expiry message  

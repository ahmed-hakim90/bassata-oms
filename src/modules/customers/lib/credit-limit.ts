/** Server-side credit capacity check (POS / AR). Limit 0 = unlimited. */
export function assertCustomerCreditCapacity(input: {
  accountBalance: number;
  creditLimit: number;
  additionalCharge: number;
}): void {
  const limit = Number(input.creditLimit) || 0;
  if (limit <= 0) return;
  const balance = Number(input.accountBalance) || 0;
  const charge = Number(input.additionalCharge) || 0;
  const nextBalance = balance + charge;
  const remaining = Math.max(0, limit - balance);
  if (nextBalance > limit + 1e-9) {
    throw new Error(
      `تم إيقاف البيع الآجل: تجاوز حد الائتمان. المتاح الآن ${remaining.toFixed(2)} من أصل ${limit.toFixed(2)} (الرصيد الحالي ${balance.toFixed(2)} + هذه الفاتورة ${charge.toFixed(2)} = ${nextBalance.toFixed(2)}). سجّل تحصيلًا أو ارفع الحد من بطاقة العميل.`
    );
  }
}

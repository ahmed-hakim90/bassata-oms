/** Notes prefix written by receive_purchase_invoice when amount_paid > 0. */
export const RECEIVE_TIME_PAYMENT_NOTES_PREFIX = "دفعة مع استلام فاتورة";

export function isReceiveTimeSupplierPayment(
  payment: { reference: string; notes: string; voided_at: string | null },
  invoiceNumber: string
): boolean {
  return (
    !payment.voided_at &&
    payment.reference === invoiceNumber &&
    payment.notes.startsWith(RECEIVE_TIME_PAYMENT_NOTES_PREFIX)
  );
}

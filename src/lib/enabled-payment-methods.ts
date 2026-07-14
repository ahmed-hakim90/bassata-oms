import type { PaymentMethod } from "@/lib/types";

/** Feature-flag shape needed to derive POS / online payment methods. */
export type PaymentMethodFlags = {
  payment_cash?: boolean;
  payment_card?: boolean;
  payment_wallet?: boolean;
  payment_other?: boolean;
  credit_sales?: boolean;
};

export function enabledPaymentMethodsFromFlags(
  flags: PaymentMethodFlags
): PaymentMethod[] {
  return [
    flags.payment_cash ? "cash" : null,
    flags.payment_card ? "card" : null,
    flags.payment_wallet ? "wallet" : null,
    flags.payment_other ? "other" : null,
    flags.credit_sales ? "credit" : null,
  ].filter((method): method is PaymentMethod => Boolean(method));
}

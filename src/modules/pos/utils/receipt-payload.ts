import type { CartLine, PaymentMethod, PaymentSplit } from "@/lib/types";
import type { ReceiptPayload } from "@/modules/pos/services/receipt-format.service";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import type { OrderWithDetails } from "@/modules/orders/services/order.service";
import type { OnlineOrderWithItems } from "@/modules/online-orders/services/online-order.service";

export function buildReceiptPayloadFromOrder(
  order: OrderWithDetails,
  branding: ReportBranding
): ReceiptPayload {
  const lines: CartLine[] = order.items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    name: item.productName,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    modifiers: [],
    lineTotal: item.line_total,
    imageUrl: null,
  }));

  const payments: PaymentSplit[] =
    order.payments.length > 0
      ? order.payments.map((payment) => ({
          method: payment.method,
          amount: payment.amount,
        }))
      : [{ method: "cash" as PaymentMethod, amount: order.total }];

  return {
    orderNumber: order.order_number,
    createdAt: order.created_at,
    lines,
    paymentMethod: payments[0]!.method,
    payments,
    discount: order.discount,
    total: order.total,
    customer: order.customerName
      ? { name: order.customerName, phone: order.customerPhone ?? "" }
      : null,
    branding,
  };
}

export function buildReceiptPayloadFromOnlineOrder(input: {
  order: OnlineOrderWithItems;
  branding: ReportBranding;
  orderNumber: string;
  payments: PaymentSplit[];
  total?: number;
  createdAt?: string;
}): ReceiptPayload {
  const lines: CartLine[] = input.order.items.map((item) => ({
    id: item.id,
    productId: item.product_id,
    variantId: item.variant_id,
    name: item.variant_name ? `${item.product_name} · ${item.variant_name}` : item.product_name,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    modifiers: [],
    lineTotal: item.line_total,
    imageUrl: null,
  }));

  const total = input.total ?? input.order.total;

  return {
    orderNumber: input.orderNumber,
    createdAt: input.createdAt ?? new Date().toISOString(),
    lines,
    paymentMethod: input.payments[0]?.method ?? "cash",
    payments: input.payments,
    discount: 0,
    total,
    customer: {
      name: input.order.customer_name,
      phone: input.order.customer_phone || "",
    },
    branding: input.branding,
  };
}

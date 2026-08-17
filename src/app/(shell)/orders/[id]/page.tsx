import { notFound } from "next/navigation";
import { OrderDetail } from "@/modules/orders/components/order-detail";
import { getOrderMutationCapabilities } from "@/modules/orders/actions/order.actions";
import { getOrder } from "@/modules/orders/services/order.service";

export default async function OrderDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, capabilities] = await Promise.all([
    getOrder(id),
    getOrderMutationCapabilities(),
  ]);
  if (!order) notFound();
  return (
    <OrderDetail
      order={order}
      canRefund={capabilities.canRefund}
      canVoid={capabilities.canVoid}
    />
  );
}

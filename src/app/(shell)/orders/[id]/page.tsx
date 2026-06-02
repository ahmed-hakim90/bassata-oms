import { notFound } from "next/navigation";
import { OrderDetail } from "@/modules/orders/components/order-detail";
import { getOrder } from "@/modules/orders/services/order.service";

export default async function OrderDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  return <OrderDetail order={order} />;
}

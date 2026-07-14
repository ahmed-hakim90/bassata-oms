import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicOnlineOrderByTrackingToken } from "@/modules/online-orders/services/online-order-tracking.service";
import { OrderTrackingPage } from "@/modules/online-orders/components/order-tracking-page";

export const dynamic = "force-dynamic";

type TrackPageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "تتبع الطلب",
    robots: { index: false, follow: false },
  };
}

export default async function OnlineOrderTrackPage({ params }: TrackPageProps) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const order = await getPublicOnlineOrderByTrackingToken(token);
  if (!order) notFound();

  return <OrderTrackingPage order={order} />;
}

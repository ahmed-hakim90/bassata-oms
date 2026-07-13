"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { StandardModalContent } from "@/components/SweetFlow/standard-modal";
import { EmptyStateBlock } from "@/components/SweetFlow/state-blocks";
import { OrderDetail } from "@/modules/orders/components/order-detail";
import { getOrderDetailAction } from "@/modules/orders/actions/order.actions";
import type { OrderWithDetails } from "@/modules/orders/services/order.service";

interface OrderDetailDialogProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailDialog({
  orderId,
  open,
  onOpenChange,
}: OrderDetailDialogProps) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !orderId) return;

    let cancelled = false;
    startTransition(async () => {
      try {
        const result = await getOrderDetailAction(orderId);
        if (cancelled) return;
        if (!result) {
          setOrder(null);
          setError("الفاتورة مش موجودة أو مفيش صلاحية لعرضها.");
          return;
        }
        setOrder(result);
        setError(null);
      } catch {
        if (cancelled) return;
        setOrder(null);
        setError("تعذر تحميل الفاتورة. حاول تاني.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  // Clear stale detail when dialog closes (adjust during render).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setOrder(null);
      setError(null);
    }
  }

  const title = order?.order_number ?? "تفاصيل الفاتورة";
  const description = order
    ? `${order.storeName} · ${new Date(order.created_at).toLocaleString("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short",
      })}`
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <StandardModalContent size="md" title={title} description={description}>
        {pending && !order && !error ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            جاري تحميل الفاتورة…
          </p>
        ) : error ? (
          <EmptyStateBlock title="مفيش فاتورة" description={error} />
        ) : order ? (
          <OrderDetail
            order={order}
            embedded
            onUpdated={() => {
              onOpenChange(false);
              router.refresh();
            }}
          />
        ) : null}
      </StandardModalContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import { OperationalCard } from "@/components/Velora/operational-card";
import { PageHeader } from "@/components/Velora/page-header";
import { StatusPill } from "@/components/Velora/status-pill";
import {
  advanceKitchenStatusAction,
  listKitchenTicketsAction,
} from "@/modules/kitchen/actions/kitchen.actions";
import { KitchenAnalyticsGlance } from "@/modules/kitchen/components/kitchen-analytics-glance";
import { buildKitchenGlance } from "@/modules/kitchen/lib/kitchen-glance";
import type {
  KitchenStatus,
  KitchenTicket,
} from "@/modules/kitchen/services/kitchen.service";

const NEXT: Partial<Record<KitchenStatus, KitchenStatus>> = {
  queued: "preparing",
  preparing: "ready",
  ready: "served",
};

const LABEL: Record<KitchenStatus, string> = {
  queued: "بالانتظار",
  preparing: "قيد التحضير",
  ready: "جاهز",
  served: "تم التسليم",
};

const VARIANT: Record<KitchenStatus, "default" | "warning" | "success" | "danger"> = {
  queued: "warning",
  preparing: "default",
  ready: "success",
  served: "default",
};

export function KitchenDisplay({ initialTickets }: { initialTickets: KitchenTicket[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [pending, startTransition] = useTransition();
  const glance = useMemo(() => buildKitchenGlance(tickets), [tickets]);

  function refresh() {
    startTransition(async () => {
      try {
        setTickets(await listKitchenTicketsAction());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "فشل التحديث");
      }
    });
  }

  useEffect(() => {
    const id = window.setInterval(refresh, 15000);
    return () => window.clearInterval(id);
  }, []);

  const columns: KitchenStatus[] = ["queued", "preparing", "ready"];

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="شاشة المطبخ"
        description="طابور الطلبات: انتظار → تحضير → جاهز"
        action={
          <CompactActions>
            <CompactAction
              label="تحديث"
              icon={RefreshCw}
              disabled={pending}
              onClick={refresh}
            />
          </CompactActions>
        }
      />

      <KitchenAnalyticsGlance glance={glance} />

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((status) => {
          const columnTickets = tickets.filter((t) => t.kitchenStatus === status);
          return (
            <OperationalCard key={status} title={LABEL[status]}>
              {columnTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا طلبات</p>
              ) : (
                <ul className="space-y-3">
                  {columnTickets.map((ticket) => (
                    <li
                      key={ticket.id}
                      className="rounded-[var(--mds-radius-md)] border border-border p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold" dir="ltr">
                          #{ticket.orderNumber}
                        </span>
                        <StatusPill
                          label={LABEL[ticket.kitchenStatus]}
                          variant={VARIANT[ticket.kitchenStatus]}
                        />
                      </div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {ticket.items.map((item, idx) => (
                          <li key={`${ticket.id}-${idx}`}>
                            {item.quantity}× {item.name}
                            {item.modifiers.length ? (
                              <span className="text-muted-foreground">
                                {" "}
                                ({item.modifiers.join("، ")})
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      {NEXT[ticket.kitchenStatus] ? (
                        <Button
                          type="button"
                          size="sm"
                          className="mt-3 w-full"
                          disabled={pending}
                          onClick={() => {
                            const next = NEXT[ticket.kitchenStatus]!;
                            startTransition(async () => {
                              const result = await advanceKitchenStatusAction(
                                ticket.id,
                                next
                              );
                              if (!result.ok) {
                                toast.error(result.error);
                                return;
                              }
                              refresh();
                            });
                          }}
                        >
                          → {LABEL[NEXT[ticket.kitchenStatus]!]}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </OperationalCard>
          );
        })}
      </div>
    </div>
  );
}

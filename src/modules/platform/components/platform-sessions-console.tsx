"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { PlatformOpenSessionRow } from "@/modules/platform/services/platform-ops.service";
import { forceClosePlatformSessionAction } from "@/modules/platform/actions/platform.actions";

export function PlatformSessionsConsole({
  sessions,
}: {
  sessions: PlatformOpenSessionRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<PlatformOpenSessionRow | null>(null);
  const [reason, setReason] = useState("");

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        title="الجلسات المفتوحة"
      />

      <OperationalCard title="جلسات مفتوحة الآن" description={`${sessions.length} جلسة`}>
        {sessions.length === 0 ? (
          <EmptyStateBlock title="مفيش جلسات مفتوحة" description="كل الورديات مقفولة دلوقتي." />
        ) : (
          <ResponsiveListLayout
            mobile={sessions.map((session) => (
              <MobileEntityCard
                key={session.id}
                title={session.cashier_name}
                subtitle={`${session.org_name} · ${session.store_name}`}
                fields={[
                  { label: "الفتح", value: formatDateTime(session.opened_at) },
                  {
                    label: "بداية النقد",
                    value: formatCurrency(session.opening_cash),
                  },
                ]}
                footer={
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      setTarget(session);
                      setReason("إغلاق إجباري من لوحة المنصة");
                    }}
                  >
                    <Ban className="size-3.5" />
                    إغلاق إجباري
                  </Button>
                }
              />
            ))}
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-2 text-start font-medium">الشركة / الفرع</th>
                      <th className="px-2 py-2 text-start font-medium">الكاشير</th>
                      <th className="px-2 py-2 text-start font-medium">الفتح</th>
                      <th className="px-2 py-2 text-start font-medium">بداية النقد</th>
                      <th className="px-2 py-2 text-start font-medium">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id} className="border-b border-border/60">
                        <td className="px-2 py-3">
                          <p className="font-medium">{session.org_name}</p>
                          <p className="text-xs text-muted-foreground">{session.store_name}</p>
                        </td>
                        <td className="px-2 py-3">{session.cashier_name}</td>
                        <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">
                          {formatDateTime(session.opened_at)}
                        </td>
                        <td className="px-2 py-3 tabular-nums">
                          {formatCurrency(session.opening_cash)}
                        </td>
                        <td className="px-2 py-3">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={pending}
                            onClick={() => {
                              setTarget(session);
                              setReason("إغلاق إجباري من لوحة المنصة");
                            }}
                          >
                            <Ban className="size-3.5" />
                            إغلاق إجباري
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          />
        )}
      </OperationalCard>

      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إغلاق إجباري للوردية</DialogTitle>
            <DialogDescription>
              {target
                ? `${target.org_name} · ${target.store_name} · ${target.cashier_name}. النقد الفعلي = رصيد البداية.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="close-reason">سبب الإغلاق</Label>
            <Input
              id="close-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="سبب واضح للمراجعة…"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setTarget(null);
                setReason("");
              }}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || reason.trim().length < 3}
              onClick={() => {
                if (!target) return;
                startTransition(async () => {
                  const result = await forceClosePlatformSessionAction({
                    sessionId: target.id,
                    closeReason: reason,
                    actualCash: target.opening_cash,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("تم إغلاق الجلسة إجباريًا");
                  setTarget(null);
                  setReason("");
                  router.refresh();
                });
              }}
            >
              إغلاق إجباري
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

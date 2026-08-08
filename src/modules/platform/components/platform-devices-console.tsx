"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, Download, Search } from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { downloadBase64Excel } from "@/modules/reports/export/excel-builder";
import type { PlatformDeviceRow } from "@/modules/platform/services/platform-ops.service";
import {
  exportPlatformDevicesExcelAction,
  setPlatformDeviceActiveAction,
} from "@/modules/platform/actions/platform.actions";

export function PlatformDevicesConsole({ devices }: { devices: PlatformDeviceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.org_name.toLowerCase().includes(q) ||
        d.store_name.toLowerCase().includes(q)
    );
  }, [devices, search]);

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        title="أجهزة POS"
        action={
          <Button
            type="button"
            variant="outline"
            disabled={pending || devices.length === 0}
            onClick={() => {
              startTransition(async () => {
                const result = await exportPlatformDevicesExcelAction();
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                downloadBase64Excel(result.data.base64, result.data.fileName);
                toast.success("تم تنزيل تقرير الأجهزة");
              });
            }}
          >
            <Download className="size-3.5" />
            تصدير Excel
          </Button>
        }
      />

      <OperationalCard title="الأجهزة" description={`${devices.length} جهاز`}>
        <div className="relative mb-4 max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالجهاز أو الشركة أو الفرع…"
            className="ps-9"
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyStateBlock title="مفيش أجهزة" description="مفيش نتائج مطابقة." />
        ) : (
          <ResponsiveListLayout
            mobile={filtered.map((device) => (
              <MobileEntityCard
                key={device.id}
                title={device.name}
                subtitle={`${device.org_name} · ${device.store_name}`}
                badge={
                  <StatusPill
                    label={device.is_active ? "نشط" : "موقوف"}
                    variant={device.is_active ? "success" : "danger"}
                  />
                }
                fields={[
                  {
                    label: "آخر ظهور",
                    value: device.last_seen_at ? formatDateTime(device.last_seen_at) : "—",
                  },
                ]}
                footer={
                  <Button
                    size="sm"
                    variant={device.is_active ? "destructive" : "outline"}
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await setPlatformDeviceActiveAction({
                          deviceId: device.id,
                          isActive: !device.is_active,
                        });
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success(
                          device.is_active ? "تم إيقاف الجهاز" : "تم تفعيل الجهاز"
                        );
                        router.refresh();
                      });
                    }}
                  >
                    {device.is_active ? (
                      <>
                        <Ban className="size-3.5" /> إيقاف
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5" /> تفعيل
                      </>
                    )}
                  </Button>
                }
              />
            ))}
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-2 text-start font-medium">الجهاز</th>
                      <th className="px-2 py-2 text-start font-medium">الشركة / الفرع</th>
                      <th className="px-2 py-2 text-start font-medium">آخر ظهور</th>
                      <th className="px-2 py-2 text-start font-medium">الحالة</th>
                      <th className="px-2 py-2 text-start font-medium">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((device) => (
                      <tr key={device.id} className="border-b border-border/60">
                        <td className="px-2 py-3 font-medium">{device.name}</td>
                        <td className="px-2 py-3">
                          <p>{device.org_name}</p>
                          <p className="text-xs text-muted-foreground">{device.store_name}</p>
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">
                          {device.last_seen_at ? formatDateTime(device.last_seen_at) : "—"}
                        </td>
                        <td className="px-2 py-3">
                          <StatusPill
                            label={device.is_active ? "نشط" : "موقوف"}
                            variant={device.is_active ? "success" : "danger"}
                          />
                        </td>
                        <td className="px-2 py-3">
                          <Button
                            size="sm"
                            variant={device.is_active ? "destructive" : "outline"}
                            disabled={pending}
                            onClick={() => {
                              startTransition(async () => {
                                const result = await setPlatformDeviceActiveAction({
                                  deviceId: device.id,
                                  isActive: !device.is_active,
                                });
                                if (!result.ok) {
                                  toast.error(result.error);
                                  return;
                                }
                                toast.success(
                                  device.is_active ? "تم إيقاف الجهاز" : "تم تفعيل الجهاز"
                                );
                                router.refresh();
                              });
                            }}
                          >
                            {device.is_active ? (
                              <>
                                <Ban className="size-3.5" /> إيقاف
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="size-3.5" /> تفعيل
                              </>
                            )}
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
    </div>
  );
}

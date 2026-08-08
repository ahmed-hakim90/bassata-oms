"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import type { PlatformAuditLogRow } from "@/modules/platform/services/platform-audit.service";

export function PlatformAuditConsole({
  auditLogs,
}: {
  auditLogs: PlatformAuditLogRow[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.entity_type.toLowerCase().includes(q) ||
        log.entity_id.toLowerCase().includes(q)
    );
  }, [auditLogs, search]);

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        title="سجل المنصة"
        description="كل إجراءات السوبر أدمن (تعليق، باقات، مستخدمين…)."
      />

      <OperationalCard title="الأحداث الأخيرة">
        <div className="mb-[var(--mds-space-4)]">
          <Label htmlFor="audit-search" className="sr-only">
            بحث في السجل
          </Label>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="audit-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالإجراء أو نوع الكيان…"
              className="ps-9"
              autoComplete="off"
            />
          </div>
        </div>

        {auditLogs.length === 0 ? (
          <EmptyStateBlock
            title="مفيش أحداث لسه"
            description="أي إجراء من لوحة المنصة هيتسجّل هنا."
          />
        ) : filtered.length === 0 ? (
          <EmptyStateBlock title="مفيش نتائج" description="جرّب كلمة بحث تانية." />
        ) : (
          <ResponsiveListLayout
            mobile={filtered.map((log) => (
              <MobileEntityCard
                key={log.id}
                title={log.action}
                subtitle={formatDateTime(log.created_at)}
                fields={[
                  { label: "الكيان", value: log.entity_type },
                  {
                    label: "المعرّف",
                    value: (
                      <span className="font-mono text-xs" dir="ltr">
                        {log.entity_id}
                      </span>
                    ),
                  },
                ]}
              />
            ))}
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-2 text-start font-medium">الوقت</th>
                      <th className="px-2 py-2 text-start font-medium">الإجراء</th>
                      <th className="px-2 py-2 text-start font-medium">الكيان</th>
                      <th className="px-2 py-2 text-start font-medium">المعرّف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((log) => (
                      <tr key={log.id} className="border-b border-border/60">
                        <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-2 py-2 font-medium">{log.action}</td>
                        <td className="px-2 py-2">{log.entity_type}</td>
                        <td className="px-2 py-2 font-mono text-xs" dir="ltr">
                          {log.entity_id}
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

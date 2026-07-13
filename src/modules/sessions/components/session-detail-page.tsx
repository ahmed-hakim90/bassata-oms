import Link from "next/link";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { SessionInvoicesTable } from "@/modules/sessions/components/session-invoices-table";
import { SessionLifecycleBadge } from "@/modules/sessions/components/session-lifecycle-badge";
import type { SessionDetail } from "@/modules/sessions/services/session-detail.service";
import type { SessionLifecycleState } from "@/lib/types";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface SessionDetailPageProps {
  detail: SessionDetail;
  lifecycle?: SessionLifecycleState | null;
}

export function SessionDetailPage({ detail, lifecycle }: SessionDetailPageProps) {
  const { session } = detail;
  const isOpen = session.status === "open";

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        breadcrumb={
          <Link href="/sessions" className="hover:text-foreground hover:underline">
            الجلسات
          </Link>
        }
        title={`جلسة ${detail.cashierName}`}
        description={`${detail.storeName}${detail.deviceName ? ` · ${detail.deviceName}` : ""} · فُتحت ${formatDateTime(session.opened_at)}${
          session.closed_at ? ` · قُفلت ${formatDateTime(session.closed_at)}` : ""
        }`}
        meta={
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isOpen ? (
              lifecycle ? (
                <SessionLifecycleBadge lifecycle={lifecycle} />
              ) : (
                <Badge variant="secondary">مفتوحة</Badge>
              )
            ) : (
              <Badge variant={session.force_closed ? "destructive" : "secondary"}>
                {session.force_closed ? "إغلاق إجباري" : "مقفولة"}
              </Badge>
            )}
            {session.force_closed && session.close_reason ? (
              <span className="text-xs text-destructive">
                السبب: {session.close_reason}
                {detail.closedByName ? ` · بواسطة ${detail.closedByName}` : ""}
              </span>
            ) : null}
          </div>
        }
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/sessions" />}
          >
            رجوع للجلسات
          </Button>
        }
      />

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-3">
        <OperationalCard
          title="الفواتير المكتملة"
          value={String(detail.orderCount)}
          subtitle={`من أصل ${detail.invoices.length} فاتورة`}
          accent="var(--mds-color-feedback-info)"
        />
        <OperationalCard
          title="إجمالي المبيعات"
          value={formatCurrency(detail.totalSales)}
          subtitle="الفواتير المكتملة فقط"
          accent="var(--mds-color-feedback-success)"
        />
        <OperationalCard
          title="بعميل"
          value={String(detail.invoicesWithCustomer)}
          subtitle={
            detail.invoices.length > 0
              ? `${detail.invoices.length - detail.invoicesWithCustomer} بدون عميل`
              : "مفيش فواتير بعد"
          }
        />
      </div>

      <section className="flex flex-col gap-[var(--mds-space-3)]">
        <h2 className="font-heading text-base font-semibold">فواتير الجلسة</h2>
        <SessionInvoicesTable invoices={detail.invoices} />
      </section>
    </div>
  );
}

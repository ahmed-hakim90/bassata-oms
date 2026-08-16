"use client";

import { PageHeader } from "@/components/Velora/page-header";
import { OperationalCard } from "@/components/Velora/operational-card";
import { StatusPill } from "@/components/Velora/status-pill";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { MobileEntityCard } from "@/components/Velora/mobile-entity-card";
import { ResponsiveListLayout } from "@/components/Velora/responsive-list-layout";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type {
  PlatformEmailStatus,
  PlatformOnlineOrderRow,
  PlatformStockAlertRow,
} from "@/modules/platform/services/platform-ops.service";

const ORDER_STATUS_AR: Record<string, string> = {
  pending: "جديد",
  accepted: "مقبول",
  preparing: "تحضير",
  ready: "جاهز",
};

export function PlatformOpsConsole(props: {
  email: PlatformEmailStatus;
  onlineOrders: PlatformOnlineOrderRow[];
  stockAlerts: PlatformStockAlertRow[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title="العمليات والمراقبة"
      />

      <OperationalCard title="Resend / البريد" description="حالة إعداد الإرسال التشغيلي">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill
            label={props.email.configured ? "مفعّل" : "غير مفعّل"}
            variant={props.email.configured ? "success" : "warning"}
          />
          <p className="text-sm text-muted-foreground">{props.email.note}</p>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">EMAIL_FROM</dt>
            <dd className="font-medium" dir="ltr">
              {props.email.from ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">EMAIL_REPLY_TO</dt>
            <dd className="font-medium" dir="ltr">
              {props.email.replyTo ?? "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          سجلات التسليم التفصيلية من{" "}
          <a
            href="https://resend.com/emails"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--mds-color-action-primary)] hover:underline"
          >
            Resend Dashboard
          </a>
          .
        </p>
      </OperationalCard>

      <OperationalCard
        title="طلبات أونلاين نشطة"
        description={`${props.onlineOrders.length} طلب (pending → ready)`}
      >
        {props.onlineOrders.length === 0 ? (
          <EmptyStateBlock title="مفيش طلبات نشطة" description="الطابور فاضي عبر كل الفروع." />
        ) : (
          <ResponsiveListLayout
            mobile={props.onlineOrders.map((order) => (
              <MobileEntityCard
                key={order.id}
                title={order.customer_name}
                subtitle={`${order.org_name} · ${order.store_name}`}
                badge={
                  <StatusPill
                    label={ORDER_STATUS_AR[order.status] ?? order.status}
                    variant={order.status === "pending" ? "warning" : "info"}
                  />
                }
                fields={[
                  {
                    label: "الهاتف",
                    value: (
                      <span dir="ltr">{order.customer_phone ?? "—"}</span>
                    ),
                  },
                  { label: "الإجمالي", value: formatCurrency(order.total) },
                  { label: "الوقت", value: formatDateTime(order.created_at) },
                ]}
              />
            ))}
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-2 text-start font-medium">الشركة / الفرع</th>
                      <th className="px-2 py-2 text-start font-medium">العميل</th>
                      <th className="px-2 py-2 text-start font-medium">الحالة</th>
                      <th className="px-2 py-2 text-start font-medium">الإجمالي</th>
                      <th className="px-2 py-2 text-start font-medium">الوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.onlineOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border/60">
                        <td className="px-2 py-3">
                          <p className="font-medium">{order.org_name}</p>
                          <p className="text-xs text-muted-foreground">{order.store_name}</p>
                        </td>
                        <td className="px-2 py-3">
                          <p>{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground" dir="ltr">
                            {order.customer_phone ?? "—"}
                          </p>
                        </td>
                        <td className="px-2 py-3">
                          <StatusPill
                            label={ORDER_STATUS_AR[order.status] ?? order.status}
                            variant={order.status === "pending" ? "warning" : "info"}
                          />
                        </td>
                        <td className="px-2 py-3 tabular-nums">
                          {formatCurrency(order.total)}
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap text-muted-foreground">
                          {formatDateTime(order.created_at)}
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

      <OperationalCard
        title="تنبيهات مخزون"
        description={`${props.stockAlerts.length} صنف عند أو تحت نقطة إعادة الطلب`}
      >
        {props.stockAlerts.length === 0 ? (
          <EmptyStateBlock title="مفيش تنبيهات" description="المخزون فوق نقاط إعادة الطلب (ضمن العينة)." />
        ) : (
          <ResponsiveListLayout
            mobile={props.stockAlerts.map((alert) => (
              <MobileEntityCard
                key={alert.id}
                title={alert.product_name}
                subtitle={`${alert.org_name} · ${alert.store_name}`}
                badge={
                  <StatusPill
                    label={alert.severity === "danger" ? "نفد" : "منخفض"}
                    variant={alert.severity === "danger" ? "danger" : "warning"}
                  />
                }
                fields={[
                  { label: "الكمية", value: alert.quantity },
                  { label: "إعادة الطلب", value: alert.reorder_point },
                ]}
              />
            ))}
            desktop={
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-2 text-start font-medium">الصنف</th>
                      <th className="px-2 py-2 text-start font-medium">الشركة / الفرع</th>
                      <th className="px-2 py-2 text-start font-medium">الكمية</th>
                      <th className="px-2 py-2 text-start font-medium">إعادة الطلب</th>
                      <th className="px-2 py-2 text-start font-medium">الخطورة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.stockAlerts.map((alert) => (
                      <tr key={alert.id} className="border-b border-border/60">
                        <td className="px-2 py-3 font-medium">{alert.product_name}</td>
                        <td className="px-2 py-3">
                          <p>{alert.org_name}</p>
                          <p className="text-xs text-muted-foreground">{alert.store_name}</p>
                        </td>
                        <td className="px-2 py-3 tabular-nums">{alert.quantity}</td>
                        <td className="px-2 py-3 tabular-nums text-muted-foreground">
                          {alert.reorder_point}
                        </td>
                        <td className="px-2 py-3">
                          <StatusPill
                            label={alert.severity === "danger" ? "نفد" : "منخفض"}
                            variant={alert.severity === "danger" ? "danger" : "warning"}
                          />
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

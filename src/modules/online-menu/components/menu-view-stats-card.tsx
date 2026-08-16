import Link from "next/link";
import {
  ONLINE_MENU_VIEW_SOURCE_LABELS_AR,
  type OnlineMenuViewSource,
} from "@/modules/online-menu/lib/online-menu-view-source";
import type { OnlineMenuViewStats } from "@/modules/online-menu/services/online-menu-views.service";

type MenuViewStatsCardProps = {
  stats: OnlineMenuViewStats;
  /** Optional deep-link to the online orders analytics board. */
  ordersHref?: string;
};

function formatCount(value: number): string {
  return new Intl.NumberFormat("ar-EG").format(value);
}

export function MenuViewStatsCard({
  stats,
  ordersHref = "/online-orders",
}: MenuViewStatsCardProps) {
  return (
    <div className="grid gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">فتحات المنيو</p>
        <p className="text-xs text-muted-foreground">آخر {stats.days} أيام</p>
      </div>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">
        {formatCount(stats.total)}
        <span className="ms-2 text-sm font-normal text-muted-foreground">فتحة</span>
      </p>
      {stats.bySource.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          لسه مفيش فتحات متسجلة. امسح QR أو افتح الرابط عشان تبدأ الإحصائيات.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {stats.bySource.map((row) => (
            <li
              key={row.source}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground">
                {ONLINE_MENU_VIEW_SOURCE_LABELS_AR[row.source as OnlineMenuViewSource] ??
                  row.source}
              </span>
              <span className="font-medium tabular-nums">{formatCount(row.viewCount)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
        المصدر بيتحدد من الرابط: QR يستخدم <span className="font-mono">src=qr</span>، ولو هتشارك
        واتساب ضيف <span className="font-mono">src=whatsapp</span>.
      </p>
      {ordersHref ? (
        <Link
          href={ordersHref}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          افتح لوحة طلبات الأونلاين والتحليل
        </Link>
      ) : null}
    </div>
  );
}

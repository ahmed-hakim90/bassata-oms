import Link from "next/link";
import {
  Clock,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  {
    href: "/pos",
    label: "نقطة البيع",
    icon: ShoppingCart,
    className: "text-[var(--mds-color-feedback-success)]",
  },
  {
    href: "/sessions",
    label: "الجلسات",
    icon: Clock,
    className: "text-[var(--mds-color-feedback-info)]",
  },
  {
    href: "/orders",
    label: "الطلبات",
    icon: Receipt,
    className: "text-[var(--mds-color-action-primary)]",
  },
  {
    href: "/expenses",
    label: "المصروفات",
    icon: Wallet,
    className: "text-[var(--mds-color-feedback-warning)]",
  },
];

export function QuickActionsBar() {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map(({ href, label, icon: Icon, className }) => (
        <Link
          key={href}
          href={href}
          className="inline-flex items-center gap-2 rounded-[var(--mds-radius-lg)] bg-card px-4 py-3 text-sm font-medium text-card-foreground shadow-[var(--mds-elevation-1)] ring-1 ring-border transition hover:bg-muted hover:shadow-[var(--mds-elevation-2)]"
        >
          <Icon className={cn("size-4", className)} />
          {label}
        </Link>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Heart,
  LayoutDashboard,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Trash2,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { filterNavByAccess } from "@/lib/auth/nav";
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";
import { useTranslation } from "@/lib/i18n/use-translation";

const iconMap = {
  ArrowLeftRight,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Clock,
  Wallet,
  FileSpreadsheet,
  Heart,
  LayoutDashboard,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Trash2,
  Truck,
  Users,
  Warehouse,
};

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav({
  userRole,
  featureFlags,
  permissions = new Set<PermissionKey>(),
}: {
  userRole: UserRole;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  permissions?: Set<PermissionKey>;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const allItems = filterNavByAccess(userRole, permissions, featureFlags).flatMap(
    (group) => group.items
  );
  const allowedItems = new Set<string>(allItems.map((item) => item.href));
  const priority = ["/", "/pos/start", "/products", "/inventory", "/settings"];
  const mobileItems = priority
    .filter((href) => allowedItems.has(href))
    .map((href) => allItems.find((item) => item.href === href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/85 backdrop-blur-xl md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {mobileItems.map((item, index) => {
          const active = isActivePath(pathname, item.href);
          const Icon = iconMap[item.icon as keyof typeof iconMap] ?? LayoutDashboard;
          return (
            <li key={`${item.href}-${index}`} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-[var(--radius-button)] px-2 py-2 text-[10px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-[var(--radius-button)] transition-all",
                    active && "bg-primary/10 shadow-[0_0_16px_-6px_var(--color-primary)]"
                  )}
                >
                  <Icon className="size-4" />
                </span>
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

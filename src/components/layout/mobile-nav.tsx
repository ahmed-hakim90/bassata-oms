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
import { filterNavByAccess, isNavHrefActive } from "@/lib/auth/nav";
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

const CASHIER_PRIORITY = ["/pos", "/orders", "/sessions", "/online-orders", "/settings"];
const MANAGER_PRIORITY = ["/", "/orders", "/sessions", "/reports", "/expenses"];
const OWNER_PRIORITY = ["/", "/pos", "/products", "/inventory", "/settings"];
const INVENTORY_PRIORITY = ["/", "/products", "/inventory", "/inventory/purchases", "/settings"];
const DEFAULT_PRIORITY = ["/", "/pos", "/products", "/inventory", "/settings"];

function priorityForRole(role: UserRole): string[] {
  if (role === "cashier") return CASHIER_PRIORITY;
  if (role === "manager") return MANAGER_PRIORITY;
  if (role === "owner") return OWNER_PRIORITY;
  if (role === "inventory") return INVENTORY_PRIORITY;
  return DEFAULT_PRIORITY;
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
  const allHrefs = allItems.map((item) => item.href);
  const priority = priorityForRole(userRole);
  const mobileItems = priority
    .filter((href) => allowedItems.has(href))
    .map((href) => allItems.find((item) => item.href === href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 5);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[var(--mds-z-sticky)] border-t border-border bg-card shadow-[0_-8px_24px_rgb(15_23_42/0.08)] md:hidden"
      aria-label={t("Navigation")}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-[var(--mds-space-1)] pb-[env(safe-area-inset-bottom)] pt-[var(--mds-space-1)]">
        {mobileItems.map((item, index) => {
          const active = isNavHrefActive(pathname, item.href, allHrefs);
          const Icon = iconMap[item.icon as keyof typeof iconMap] ?? LayoutDashboard;
          return (
            <li key={`${item.href}-${index}`} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[52px] flex-col items-center gap-0.5 rounded-[var(--mds-radius-md)] px-[var(--mds-space-1)] py-[var(--mds-space-2)] text-[10px] transition-colors",
                  active
                    ? "font-semibold text-primary"
                    : "font-medium text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-[var(--mds-radius-md)] transition-all",
                    active
                      ? "bg-[var(--mds-color-harbor-50)] text-[var(--mds-color-action-primary)] shadow-[var(--mds-elevation-1)] ring-1 ring-[var(--mds-color-action-primary)]/25"
                      : ""
                  )}
                >
                  <Icon className="size-[18px]" />
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

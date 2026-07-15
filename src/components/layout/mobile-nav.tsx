"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Clock,
  CircleDollarSign,
  Ellipsis,
  FileSpreadsheet,
  Heart,
  LayoutDashboard,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
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
import { useUiStore } from "@/stores/ui-store";

const iconMap = {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Clock,
  CircleDollarSign,
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
  Tag,
  Trash2,
  Truck,
  Users,
  Warehouse,
};

/** Primary tabs (excluding More). More always fills the 5th slot. */
const CASHIER_PRIORITY = ["/pos", "/sales-invoices", "/orders", "/sessions", "/online-orders", "/settings"];
const MANAGER_PRIORITY = ["/", "/pos", "/orders", "/sessions", "/reports", "/expenses"];
const OWNER_PRIORITY = ["/", "/pos", "/products", "/inventory", "/settings"];
const INVENTORY_PRIORITY = ["/", "/products", "/inventory", "/inventory/purchases", "/settings"];
const DEFAULT_PRIORITY = ["/", "/pos", "/products", "/inventory", "/settings"];

const TAB_SLOT_COUNT = 4;

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
  enableWholesaleSales,
  allowCashierWholesale,
  permissions = [],
}: {
  userRole: UserRole;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  enableWholesaleSales?: boolean;
  allowCashierWholesale?: boolean;
  permissions?: PermissionKey[];
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const openMobileNavSheet = useUiStore((s) => s.openMobileNavSheet);
  const mobileNavSheetOpen = useUiStore((s) => s.mobileNavSheetOpen);

  const allItems = filterNavByAccess(
    userRole,
    new Set(permissions),
    featureFlags,
    { enableWholesaleSales, allowCashierWholesale }
  ).flatMap((group) => group.items);
  const allowedItems = new Set<string>(allItems.map((item) => item.href));
  const allHrefs = allItems.map((item) => item.href);
  const priority = priorityForRole(userRole);
  const mobileItems = priority
    .filter((href) => allowedItems.has(href))
    .map((href) => allItems.find((item) => item.href === href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, TAB_SLOT_COUNT);

  const onPrimaryTab = mobileItems.some((item) =>
    isNavHrefActive(pathname, item.href, allHrefs)
  );
  const moreActive = mobileNavSheetOpen || !onPrimaryTab;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[var(--mds-z-sticky)] border-t border-border/80 bg-card/95 shadow-[0_-4px_24px_rgb(15_23_42/0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/85 md:hidden"
      aria-label={t("Navigation")}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)] pt-1">
        {mobileItems.map((item, index) => {
          const active = isNavHrefActive(pathname, item.href, allHrefs);
          const Icon = iconMap[item.icon as keyof typeof iconMap] ?? LayoutDashboard;
          return (
            <li key={`${item.href}-${index}`} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[52px] touch-manipulation flex-col items-center justify-center gap-0.5 rounded-[var(--mds-radius-md)] px-1 py-1.5 text-[10px] transition-colors",
                  active
                    ? "font-semibold text-primary"
                    : "font-medium text-muted-foreground active:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full transition-all",
                    active
                      ? "bg-[var(--mds-color-harbor-50)] text-[var(--mds-color-action-primary)] ring-1 ring-[var(--mds-color-action-primary)]/20 dark:bg-primary/15"
                      : ""
                  )}
                >
                  <Icon className="size-[20px]" strokeWidth={active ? 2.25 : 2} />
                </span>
                <span className="max-w-full truncate leading-none">{t(item.label)}</span>
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={openMobileNavSheet}
            aria-expanded={mobileNavSheetOpen}
            aria-controls="mobile-nav-sheet"
            aria-label={t("More")}
            className={cn(
              "flex min-h-[52px] w-full touch-manipulation flex-col items-center justify-center gap-0.5 rounded-[var(--mds-radius-md)] px-1 py-1.5 text-[10px] transition-colors",
              moreActive
                ? "font-semibold text-primary"
                : "font-medium text-muted-foreground active:text-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full transition-all",
                moreActive
                  ? "bg-[var(--mds-color-harbor-50)] text-[var(--mds-color-action-primary)] ring-1 ring-[var(--mds-color-action-primary)]/20 dark:bg-primary/15"
                  : ""
              )}
            >
              <Ellipsis className="size-[20px]" strokeWidth={moreActive ? 2.25 : 2} />
            </span>
            <span className="leading-none">{t("More")}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

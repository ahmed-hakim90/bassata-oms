"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Barcode,
  BookOpen,
  Calculator,
  Calendar,
  CircleDollarSign,
  Building2,
  MonitorSmartphone,
  CalendarCheck,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Heart,
  LayoutDashboard,
  Landmark,
  Package,
  PieChart,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Trash2,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
  ChevronDown,
  ChevronLeft,
  LogOut,
  Menu,
} from "lucide-react";
import { APP_NAME, APP_TAGLINE_AR } from "@/lib/constants";
import type { UserRole, PermissionKey } from "@/lib/constants";
import type { FeatureFlag } from "@/lib/constants";
import { filterNavByAccess, isNavHrefActive, ROLE_LABELS_AR } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n/use-translation";
import { AppBrandMark } from "@/components/layout/app-brand-mark";
import { PoweredByHakimo } from "@/components/layout/powered-by-hakimo";
import { logoutAction } from "@/modules/auth/actions/logout.action";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  BookOpen,
  Building2,
  Calculator,
  MonitorSmartphone,
  ShoppingCart,
  Receipt,
  Package,
  PieChart,
  Warehouse,
  Truck,
  ArrowLeftRight,
  Trash2,
  TrendingUp,
  ClipboardList,
  Clock,
  Wallet,
  Users,
  Heart,
  Tag,
  Landmark,
  BarChart3,
  Barcode,
  Calendar,
  CalendarCheck,
  CircleDollarSign,
  FileSpreadsheet,
  Settings,
  Shield,
  ScrollText,
};

const ROLE_SUBTITLE: Record<UserRole, string> = {
  owner: "إدارة كاملة",
  manager: "تشغيل الفرع",
  cashier: "بيع وورديات",
  inventory: "مخزون ومشتريات",
};

export function AppSidebar({
  userRole,
  featureFlags,
  enableWholesaleSales,
  allowCashierWholesale,
  enableKitchenDisplay,
  permissions = [],
  className,
  forceExpanded = false,
}: {
  userRole: UserRole;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  enableWholesaleSales?: boolean;
  allowCashierWholesale?: boolean;
  enableKitchenDisplay?: boolean;
  permissions?: PermissionKey[];
  className?: string;
  forceExpanded?: boolean;
}) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, collapsedGroups, toggleGroup } =
    useUiStore();
  const collapsed = forceExpanded ? false : sidebarCollapsed;
  const navGroups = filterNavByAccess(
    userRole,
    new Set(permissions),
    featureFlags,
    { enableWholesaleSales, allowCashierWholesale, enableKitchenDisplay }
  );
  const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));

  return (
    <TooltipProvider delay={300}>
      <aside
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden border-e border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[var(--mds-elevation-2)] transition-[width] duration-[var(--mds-motion-normal)] ease-[var(--mds-motion-easing-standard)]",
          collapsed ? "w-[76px]" : "w-[17rem]",
          className
        )}
      >
        {collapsed && !forceExpanded ? (
          <div className="flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border bg-[linear-gradient(135deg,rgb(103_232_249/0.16),transparent_55%)]">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-[var(--mds-sidebar-hover)] hover:text-sidebar-foreground"
              onClick={toggleSidebar}
              aria-label={t("Expand sidebar")}
            >
              <Menu className="size-5" />
            </Button>
          </div>
        ) : (
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border bg-[linear-gradient(135deg,rgb(103_232_249/0.16),transparent_55%)] px-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--mds-radius-md)] bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--mds-elevation-1)]">
              <AppBrandMark />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                {APP_NAME}
              </p>
              <p className="truncate text-[11px]" style={{ color: "var(--mds-sidebar-muted)" }}>
                {ROLE_SUBTITLE[userRole]}
              </p>
            </div>
            {!forceExpanded && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-sidebar-foreground hover:bg-[var(--mds-sidebar-hover)] hover:text-sidebar-foreground"
                onClick={toggleSidebar}
                aria-label={t("Collapse sidebar")}
              >
                <ChevronLeft className="size-4 rtl:rotate-180" />
              </Button>
            )}
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1 overflow-hidden px-2.5 py-4">
          <nav className="space-y-5">
            {navGroups.map((group) => {
              const groupHrefs = group.items.map((i) => i.href);
              const hasActiveItem = group.items.some((item) =>
                isNavHrefActive(pathname, item.href, allHrefs)
              );
              // Keep the section open when it contains the current page.
              const groupCollapsed = hasActiveItem
                ? false
                : Boolean(collapsedGroups[group.label]);
              const GroupIcon = iconMap[group.icon] ?? LayoutDashboard;
              return (
                <div key={group.label}>
                  {!collapsed && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      aria-expanded={!groupCollapsed}
                      className={cn(
                        "mb-1.5 flex w-full items-center justify-between gap-2 rounded-[var(--mds-radius-sm)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors hover:bg-[var(--mds-sidebar-hover)]",
                        hasActiveItem && "text-sidebar-primary"
                      )}
                      style={
                        hasActiveItem
                          ? undefined
                          : { color: "var(--mds-sidebar-muted)" }
                      }
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <GroupIcon className="size-3.5 shrink-0 opacity-85" aria-hidden />
                        <span className="truncate">{t(group.label)}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="tabular-nums opacity-70">
                          {group.items.length}
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-3.5 shrink-0 transition-transform duration-200",
                            groupCollapsed && "-rotate-90"
                          )}
                          aria-hidden
                        />
                      </span>
                    </button>
                  )}
                  {(!groupCollapsed || collapsed) && (
                    <ul className="space-y-1">
                      {group.items.map((item, index) => {
                        const Icon = iconMap[item.icon] ?? LayoutDashboard;
                        const active = isNavHrefActive(
                          pathname,
                          item.href,
                          groupHrefs.length > 1 ? allHrefs : groupHrefs
                        );
                        return (
                          <li key={`${group.label}-${item.href}-${index}`}>
                            {collapsed ? (
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <Link
                                      href={item.href}
                                      aria-current={active ? "page" : undefined}
                                      className={cn(
                                        "relative flex items-center justify-center rounded-[var(--mds-radius-md)] p-2.5 text-sm transition-colors",
                                        active
                                          ? "bg-sidebar-accent text-sidebar-primary"
                                          : "text-sidebar-foreground/75 hover:bg-[var(--mds-sidebar-hover)] hover:text-sidebar-foreground"
                                      )}
                                    />
                                  }
                                >
                                  <Icon className="size-4 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent side="left">{t(item.label)}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Link
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "relative flex items-center gap-3 rounded-[var(--mds-radius-md)] px-3 py-2.5 text-sm transition-colors",
                                  active
                                    ? "bg-sidebar-accent font-semibold text-sidebar-primary"
                                    : "font-medium text-sidebar-foreground/80 hover:bg-[var(--mds-sidebar-hover)] hover:text-sidebar-foreground"
                                )}
                              >
                                {active ? (
                                  <span
                                    className="absolute inset-e-0 inset-y-1.5 w-1 rounded-s-full bg-sidebar-primary"
                                    aria-hidden
                                  />
                                ) : null}
                                <Icon className="size-4 shrink-0 opacity-90" />
                                <span className="truncate">{t(item.label)}</span>
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
          {!collapsed ? (
            <div className="space-y-2">
              <div>
                <p className="text-xs font-medium text-sidebar-foreground">
                  {ROLE_LABELS_AR[userRole]}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: "var(--mds-sidebar-muted)" }}>
                  {APP_TAGLINE_AR}
                </p>
              </div>
              <SidebarSignOut collapsed={false} label={t("Sign out")} />
              <PoweredByHakimo tone="sidebar" className="justify-start px-0.5 py-0.5" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <SidebarSignOut collapsed label={t("Sign out")} />
              <PoweredByHakimo
                compact
                tone="sidebar"
                className="size-8 rounded-[var(--mds-radius-md)] hover:bg-[var(--mds-sidebar-hover)]"
              />
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

function SidebarSignOut({ collapsed, label }: { collapsed: boolean; label: string }) {
  if (collapsed) {
    return (
      <Tooltip>
        <form action={logoutAction}>
          <TooltipTrigger
            render={
              <Button
                type="submit"
                variant="ghost"
                size="icon-sm"
                className="text-sidebar-foreground/80 hover:bg-[var(--mds-sidebar-hover)] hover:text-destructive"
                aria-label={label}
              />
            }
          >
            <LogOut className="size-4" />
          </TooltipTrigger>
        </form>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="ghost"
        className="h-9 w-full justify-start gap-2 rounded-[var(--mds-radius-md)] px-3 text-sm font-medium text-sidebar-foreground/80 hover:bg-[var(--mds-sidebar-hover)] hover:text-destructive"
      >
        <LogOut className="size-4 shrink-0" />
        {label}
      </Button>
    </form>
  );
}

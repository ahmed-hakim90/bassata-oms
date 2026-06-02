"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  CalendarCheck,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Heart,
  LayoutDashboard,
  Landmark,
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
  ChevronLeft,
  ChevronRight,
  IceCream,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import type { UserRole, PermissionKey } from "@/lib/constants";
import type { FeatureFlag } from "@/lib/constants";
import { filterNavByAccess } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Building2,
  ShoppingCart,
  Receipt,
  Package,
  Warehouse,
  Truck,
  ArrowLeftRight,
  Trash2,
  ClipboardList,
  Clock,
  Wallet,
  Users,
  Heart,
  Landmark,
  BarChart3,
  CalendarCheck,
  FileSpreadsheet,
  Settings,
  Shield,
  ScrollText,
};

export function AppSidebar({
  userRole,
  featureFlags,
  permissions = new Set<PermissionKey>(),
}: {
  userRole: UserRole;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  permissions?: Set<PermissionKey>;
}) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, collapsedGroups, toggleGroup } =
    useUiStore();
  const navGroups = filterNavByAccess(userRole, permissions, featureFlags);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border/60 bg-sidebar/80 backdrop-blur-xl transition-all duration-300",
        sidebarCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-border/60 px-4">
        <div className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <IceCream className="size-5" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{APP_NAME}</p>
            <p className="text-xs text-muted-foreground">Operations</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("ml-auto", sidebarCollapsed && "mx-auto")}
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="space-y-6">
          {navGroups.map((group) => {
            const collapsed = collapsedGroups[group.label];
            return (
              <div key={group.label}>
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="mb-2 flex w-full items-center px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    {group.label}
                  </button>
                )}
                {(!collapsed || sidebarCollapsed) && (
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = iconMap[item.icon] ?? LayoutDashboard;
                      const active =
                        pathname === item.href ||
                        (item.href !== "/" &&
                          pathname.startsWith(item.href));
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
                              active
                                ? "bg-primary/10 text-primary shadow-sm shadow-primary/10"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                              sidebarCollapsed && "justify-center px-2"
                            )}
                            title={sidebarCollapsed ? item.label : undefined}
                          >
                            <Icon className="size-4 shrink-0" />
                            {!sidebarCollapsed && item.label}
                          </Link>
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
    </aside>
  );
}

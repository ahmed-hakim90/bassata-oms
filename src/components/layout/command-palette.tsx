"use client";

import { useCallback, useMemo, type ComponentType } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  ArrowLeftRight,
  BarChart3,
  Barcode,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarCheck2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileBadge,
  FileSpreadsheet,
  Flame,
  Heart,
  Landmark,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  PackagePlus,
  Percent,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import {
  CommandJumpDialog,
  pushRecentHref,
  readRecentHrefs,
  useCommandPaletteHotkey,
  type CommandJumpGroup,
  type CommandJumpItem,
} from "@/components/layout/command-jump-dialog";
import { getCommandPaletteGroups } from "@/lib/auth/command-destinations";
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";
import { useModShortcutLabel } from "@/lib/keyboard";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUiStore } from "@/stores/ui-store";

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  BookOpen,
  Building2,
  MonitorSmartphone,
  ShoppingCart,
  Receipt,
  Package,
  PackagePlus,
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
  CalendarCheck2,
  CircleDollarSign,
  FileBadge,
  FileSpreadsheet,
  Flame,
  Percent,
  Settings,
  Shield,
  ScrollText,
};

const RECENT_KEY = "cafeflow-command-recent";

export function CommandPalette({
  userRole,
  permissions = [],
  featureFlags,
  enableWholesaleSales,
  allowCashierWholesale,
  enableKitchenDisplay,
}: {
  userRole: UserRole;
  permissions?: PermissionKey[];
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  enableWholesaleSales?: boolean;
  allowCashierWholesale?: boolean;
  enableKitchenDisplay?: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const shortcutLabel = useModShortcutLabel("k");

  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const sourceGroups = useMemo(
    () =>
      getCommandPaletteGroups(userRole, permissionSet, featureFlags, {
        enableWholesaleSales,
        allowCashierWholesale,
        enableKitchenDisplay,
      }),
    [
      userRole,
      permissionSet,
      featureFlags,
      enableWholesaleSales,
      allowCashierWholesale,
      enableKitchenDisplay,
    ]
  );

  const groups: CommandJumpGroup[] = useMemo(
    () =>
      sourceGroups.map((group) => ({
        label: t(group.label),
        items: group.items.map((item) => ({
          href: item.href,
          label: t(item.label),
          keywords: item.keywords,
          Icon: iconMap[item.icon] ?? LayoutDashboard,
        })),
      })),
    [sourceGroups, t]
  );

  const itemByHref = useMemo(() => {
    const map = new Map<string, CommandJumpItem>();
    for (const group of groups) {
      for (const item of group.items) map.set(item.href, item);
    }
    return map;
  }, [groups]);

  const allowedHrefs = useMemo(() => new Set(itemByHref.keys()), [itemByHref]);
  const recent = open ? readRecentHrefs(RECENT_KEY, allowedHrefs) : [];
  const recentItems = recent
    .map((href) => itemByHref.get(href))
    .filter((item): item is CommandJumpItem => Boolean(item));

  useCommandPaletteHotkey();

  const navigate = useCallback(
    (href: string) => {
      pushRecentHref(RECENT_KEY, href);
      setOpen(false);
      router.push(href);
    },
    [router, setOpen]
  );

  const footerHint =
    shortcutLabel.startsWith("⌘")
      ? t("Press ⌘K to open quickly")
      : t("Press Ctrl+K to open quickly");

  return (
    <CommandJumpDialog
      open={open}
      onOpenChange={setOpen}
      title={t("Command palette")}
      description={t("Search pages and jump quickly")}
      placeholder={t("Type a command or search...")}
      emptyLabel={t("No results found.")}
      recentHeading={t("Recent")}
      recentItems={recentItems}
      groups={groups}
      footerHint={footerHint}
      shortcutLabel={shortcutLabel}
      onSelect={navigate}
    />
  );
}

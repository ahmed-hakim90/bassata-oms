"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Barcode,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CircleDollarSign,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  Heart,
  Landmark,
  LayoutDashboard,
  MonitorSmartphone,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { filterNavByAccess } from "@/lib/auth/nav";
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";
import { useModShortcutLabel } from "@/lib/keyboard";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUiStore } from "@/stores/ui-store";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  BookOpen,
  Building2,
  MonitorSmartphone,
  ShoppingCart,
  Receipt,
  Package,
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

const RECENT_KEY = "cafeflow-command-recent";
const MAX_RECENT = 5;

type NavHref = ReturnType<typeof filterNavByAccess>[number]["items"][number]["href"];

function isNavHref(value: unknown, allowed: Set<string>): value is NavHref {
  return typeof value === "string" && allowed.has(value);
}

function readRecent(allowed: Set<string>): NavHref[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is NavHref => isNavHref(x, allowed))
      : [];
  } catch {
    return [];
  }
}

function pushRecent(href: NavHref) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const prev = raw ? (JSON.parse(raw) as unknown) : [];
    const prevHrefs = Array.isArray(prev)
      ? prev.filter((x): x is string => typeof x === "string" && x !== href)
      : [];
    localStorage.setItem(RECENT_KEY, JSON.stringify([href, ...prevHrefs].slice(0, MAX_RECENT)));
  } catch {
    localStorage.setItem(RECENT_KEY, JSON.stringify([href]));
  }
}

export function CommandPalette({
  userRole,
  permissions = new Set<PermissionKey>(),
  featureFlags,
}: {
  userRole: UserRole;
  permissions?: Set<PermissionKey>;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const shortcutLabel = useModShortcutLabel("k");

  const navGroups = useMemo(
    () => filterNavByAccess(userRole, permissions, featureFlags),
    [userRole, permissions, featureFlags]
  );

  const allItems = useMemo(
    () => navGroups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label }))),
    [navGroups]
  );

  const itemByHref = useMemo(() => {
    const map = new Map(allItems.map((item) => [item.href, item]));
    return map;
  }, [allItems]);

  const allowedHrefs = useMemo(
    () => new Set(allItems.map((item) => item.href)),
    [allItems]
  );

  const recent = open ? readRecent(allowedHrefs) : [];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandPaletteOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  const navigate = useCallback(
    (href: NavHref) => {
      pushRecent(href);
      setOpen(false);
      router.push(href);
    },
    [router, setOpen]
  );

  const recentItems = recent
    .map((href) => itemByHref.get(href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const footerHint =
    shortcutLabel.startsWith("⌘")
      ? t("Press ⌘K to open quickly")
      : t("Press Ctrl+K to open quickly");

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title={t("Command palette")}
      description={t("Search pages and jump quickly")}
    >
      <Command>
        <CommandInput placeholder={t("Type a command or search...")} />
        <CommandList>
          <CommandEmpty>{t("No results found.")}</CommandEmpty>
          {recentItems.length > 0 ? (
            <>
              <CommandGroup heading={t("Recent")}>
                {recentItems.map((item) => {
                  const Icon = iconMap[item.icon] ?? LayoutDashboard;
                  return (
                    <CommandItem
                      key={`recent-${item.href}`}
                      value={`${t(item.label)} ${item.href} recent`}
                      onSelect={() => navigate(item.href)}
                    >
                      <Icon />
                      <span>{t(item.label)}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          ) : null}
          {navGroups.map((group) => (
            <CommandGroup key={group.label} heading={t(group.label)}>
              {group.items.map((item) => {
                const Icon = iconMap[item.icon] ?? LayoutDashboard;
                return (
                  <CommandItem
                    key={`${group.label}-${item.href}`}
                    value={`${t(item.label)} ${t(group.label)} ${item.href}`}
                    onSelect={() => navigate(item.href)}
                  >
                    <Icon />
                    <span>{t(item.label)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
        <div className="flex items-center justify-between gap-[var(--mds-space-2)] border-t border-border px-[var(--mds-space-3)] py-[var(--mds-space-2)] text-[11px] text-muted-foreground">
          <span>{footerHint}</span>
          <kbd
            className="rounded-[var(--mds-radius-sm)] border border-border bg-muted px-[var(--mds-space-1)] py-0.5 font-mono text-[10px]"
            suppressHydrationWarning
          >
            {shortcutLabel}
          </kbd>
        </div>
      </Command>
    </CommandDialog>
  );
}

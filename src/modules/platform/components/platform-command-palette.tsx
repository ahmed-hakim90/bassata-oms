"use client";

import { useCallback, useMemo } from "react";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import {
  CommandJumpDialog,
  pushRecentHref,
  readRecentHrefs,
  useCommandPaletteHotkey,
  type CommandJumpGroup,
  type CommandJumpItem,
} from "@/components/layout/command-jump-dialog";
import { useModShortcutLabel } from "@/lib/keyboard";
import { useUiStore } from "@/stores/ui-store";
import { PLATFORM_NAV_GROUPS } from "@/modules/platform/lib/platform-nav";

const RECENT_KEY = "velora-platform-command-recent";

export function PlatformCommandPalette() {
  const router = useRouter();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const shortcutLabel = useModShortcutLabel("k");

  const groups: CommandJumpGroup[] = useMemo(
    () =>
      PLATFORM_NAV_GROUPS.map((group) => ({
        label: group.label,
        items: group.items.map((item) => ({
          href: item.href,
          label: item.label,
          keywords: [item.description, group.label],
          Icon: item.icon,
        })),
      })),
    []
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

  const footerHint = shortcutLabel.startsWith("⌘")
    ? "اضغط ⌘K للفتح السريع"
    : "اضغط Ctrl+K للفتح السريع";

  return (
    <CommandJumpDialog
      open={open}
      onOpenChange={setOpen}
      title="بحث المنصة"
      description="ابحث في صفحات سوبر أدمن"
      placeholder="ابحث في الشركات، الجلسات، الثيمات..."
      emptyLabel="لا توجد نتائج."
      recentHeading="الأخيرة"
      recentItems={recentItems}
      groups={groups}
      footerHint={footerHint}
      shortcutLabel={shortcutLabel}
      onSelect={navigate}
    />
  );
}

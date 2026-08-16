"use client";

import { useEffect, type ComponentType } from "react";
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
import { useUiStore } from "@/stores/ui-store";

const MAX_RECENT = 8;

export function useCommandPaletteHotkey() {
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!useUiStore.getState().commandPaletteOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);
}

function isAllowedHref(value: unknown, allowed: Set<string>): value is string {
  return typeof value === "string" && allowed.has(value);
}

export function readRecentHrefs(storageKey: string, allowed: Set<string>): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((href): href is string => isAllowedHref(href, allowed))
      : [];
  } catch {
    return [];
  }
}

export function pushRecentHref(storageKey: string, href: string) {
  try {
    const raw = localStorage.getItem(storageKey);
    const prev = raw ? (JSON.parse(raw) as unknown) : [];
    const prevHrefs = Array.isArray(prev)
      ? prev.filter((value): value is string => typeof value === "string" && value !== href)
      : [];
    localStorage.setItem(storageKey, JSON.stringify([href, ...prevHrefs].slice(0, MAX_RECENT)));
  } catch {
    localStorage.setItem(storageKey, JSON.stringify([href]));
  }
}

export type CommandJumpItem = {
  href: string;
  label: string;
  keywords?: string[];
  Icon: ComponentType<{ className?: string }>;
};

export type CommandJumpGroup = {
  label: string;
  items: CommandJumpItem[];
};

export function CommandJumpDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  emptyLabel,
  recentHeading,
  recentItems,
  groups,
  footerHint,
  shortcutLabel,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  placeholder: string;
  emptyLabel: string;
  recentHeading: string;
  recentItems: CommandJumpItem[];
  groups: CommandJumpGroup[];
  footerHint: string;
  shortcutLabel: string;
  onSelect: (href: string) => void;
}) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <Command>
        <CommandInput placeholder={placeholder} />
        <CommandList>
          <CommandEmpty>{emptyLabel}</CommandEmpty>
          {recentItems.length > 0 ? (
            <>
              <CommandGroup heading={recentHeading}>
                {recentItems.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <CommandItem
                      key={`recent-${item.href}`}
                      value={`${item.label} ${item.href} ${(item.keywords ?? []).join(" ")} recent`}
                      onSelect={() => onSelect(item.href)}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
            </>
          ) : null}
          {groups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.Icon;
                return (
                  <CommandItem
                    key={`${group.label}-${item.href}`}
                    value={`${item.label} ${group.label} ${item.href} ${(item.keywords ?? []).join(" ")}`}
                    onSelect={() => onSelect(item.href)}
                  >
                    <Icon />
                    <span>{item.label}</span>
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

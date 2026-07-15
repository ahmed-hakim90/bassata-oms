"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useTransition } from "react";
import { LogOut, Menu, Search, ShoppingCart, Store } from "lucide-react";
import { logoutAction } from "@/modules/auth/actions/logout.action";
import { setActiveStoreAction } from "@/modules/auth/actions/set-store.action";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useModShortcutLabel } from "@/lib/keyboard";
import { selectLabelById } from "@/lib/select-label";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { FeatureFlag, PermissionKey, UserRole } from "@/lib/constants";
import type { Store as StoreType } from "@/lib/types";
import type { PosReadinessState } from "@/lib/auth/pos-readiness";
import { ROLE_LABELS_AR } from "@/lib/auth/nav";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUiStore } from "@/stores/ui-store";
import { firstGrapheme } from "@/lib/first-grapheme";

interface AppShellHeaderProps {
  userName: string;
  userRole: UserRole;
  stores: StoreType[];
  activeStoreId: string | null;
  featureFlags?: Partial<Record<FeatureFlag, boolean>>;
  enableWholesaleSales?: boolean;
  allowCashierWholesale?: boolean;
  permissions?: PermissionKey[];
  posReadinessState?: PosReadinessState;
}

function posCta(state?: PosReadinessState) {
  if (state === "no_session") {
    return {
      label: "فتح جلسة",
      short: "جلسة",
      className:
        "bg-[var(--mds-color-feedback-warning)] text-white hover:opacity-90 shadow-[var(--mds-elevation-1)]",
    };
  }
  if (state === "session_expired" || state === "session_warning") {
    return {
      label: "الجلسات",
      short: "جلسة",
      href: "/sessions" as const,
      className:
        "bg-[var(--mds-color-feedback-danger)] text-white hover:opacity-90 shadow-[var(--mds-elevation-1)]",
    };
  }
  if (state === "ready") {
    return {
      label: "نقطة البيع",
      short: "بيع",
      className:
        "bg-[var(--mds-color-feedback-success)] text-white hover:opacity-90 shadow-[var(--mds-elevation-1)]",
    };
  }
  return {
    label: "نقطة البيع",
    short: "بيع",
    className: "",
  };
}

export function AppShellHeader({
  userName,
  userRole,
  stores,
  activeStoreId,
  featureFlags,
  enableWholesaleSales,
  allowCashierWholesale,
  permissions = [],
  posReadinessState,
}: AppShellHeaderProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const mobileNavOpen = useUiStore((s) => s.mobileNavSheetOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavSheetOpen);
  const shortcutLabel = useModShortcutLabel("k");
  const selectedId = activeStoreId ?? stores[0]?.id;
  const cta = posCta(posReadinessState);
  const posHref = cta.href ?? "/pos";
  const roleLabel = ROLE_LABELS_AR[userRole];
  const activeStoreName = stores.find((s) => s.id === selectedId)?.name;

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  const openPalette = () => setCommandPaletteOpen(true);
  const paletteTooltip =
    shortcutLabel.startsWith("⌘")
      ? t("Press ⌘K to open quickly")
      : t("Press Ctrl+K to open quickly");

  const handleMenuClick = () => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      toggleSidebar();
      return;
    }
    setMobileNavOpen(true);
  };

  return (
    <TooltipProvider delay={300}>
      <header className="sticky top-0 z-[calc(var(--mds-z-sticky)+1)] shrink-0 border-b border-border/80 bg-card/95 pt-[env(safe-area-inset-top)] shadow-[var(--mds-elevation-1)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/85">
        <div className="flex h-12 items-center gap-1 px-2 md:h-14 md:gap-[var(--mds-space-2)] md:px-[var(--mds-space-5)]">
          {/* ── Leading: menu + identity ── */}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-[var(--mds-space-2)]">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-10 shrink-0 touch-manipulation md:size-8"
              aria-label={t("Open menu")}
              aria-expanded={mobileNavOpen || !sidebarCollapsed}
              aria-controls="mobile-nav-sheet"
              onClick={handleMenuClick}
            >
              <Menu className="size-5 md:size-4" />
            </Button>
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetContent
                id="mobile-nav-sheet"
                side="right"
                className="w-[min(20rem,88vw)] gap-0 overflow-hidden p-0 sm:max-w-72"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>{t("Navigation")}</SheetTitle>
                </SheetHeader>
                <AppSidebar
                  userRole={userRole}
                  featureFlags={featureFlags}
                  enableWholesaleSales={enableWholesaleSales}
                  allowCashierWholesale={allowCashierWholesale}
                  permissions={permissions}
                  forceExpanded
                  className="h-full w-full border-e-0 shadow-none"
                />
              </SheetContent>
            </Sheet>

            <Link
              href="/account"
              className="flex min-w-0 items-center gap-[var(--mds-space-2)] rounded-[var(--mds-radius-md)] outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={t("Account")}
            >
              <span
                className="flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary md:size-7 dark:bg-primary/15"
                aria-hidden
              >
                {firstGrapheme(userName, "?")}
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-foreground">
                  {userName}
                </p>
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  <span className="md:hidden">{activeStoreName ?? roleLabel}</span>
                  <span className="hidden md:inline">
                    {roleLabel}
                    {activeStoreName ? ` · ${activeStoreName}` : ""}
                  </span>
                </p>
              </div>
            </Link>
          </div>

          {/* ── Trailing actions ── */}
          <div className="flex shrink-0 items-center gap-0.5 md:gap-[var(--mds-space-2)]">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hidden gap-[var(--mds-space-2)] text-muted-foreground sm:inline-flex"
                    onClick={openPalette}
                    aria-label={t("Open command palette")}
                    aria-keyshortcuts="Meta+K Control+K"
                  />
                }
              >
                <Search className="size-3.5" />
                <span className="text-xs">{t("Search")}</span>
                <kbd
                  className="ms-1 hidden rounded-[var(--mds-radius-sm)] border border-border bg-muted px-[var(--mds-space-1)] py-0.5 font-mono text-[10px] text-muted-foreground lg:inline"
                  suppressHydrationWarning
                >
                  {shortcutLabel}
                </kbd>
              </TooltipTrigger>
              <TooltipContent side="bottom">{paletteTooltip}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-10 touch-manipulation sm:hidden"
                    onClick={openPalette}
                    aria-label={t("Open command palette")}
                    aria-keyshortcuts="Meta+K Control+K"
                  />
                }
              >
                <Search className="size-5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">{paletteTooltip}</TooltipContent>
            </Tooltip>

            <div className="hidden sm:block">
              <ThemeToggle darkModeEnabled={featureFlags?.dark_mode !== false} />
            </div>

            {stores.length > 0 && (
              <>
                <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
                <div className="flex items-center gap-[var(--mds-space-1)]">
                  <Store className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden />
                  <Select
                    value={selectedId}
                    onValueChange={(storeId) => {
                      if (!storeId) return;
                      startTransition(async () => {
                        await setActiveStoreAction(storeId);
                      });
                    }}
                  >
                    <SelectTrigger
                      className="h-9 max-w-[7.5rem] rounded-[var(--mds-radius-md)] touch-manipulation sm:h-8 sm:max-w-[13rem]"
                      disabled={pending}
                      aria-label={t("Select store")}
                    >
                      <SelectValue placeholder={t("Select store")}>
                        {(value) => selectLabelById(stores, value, (s) => s.name)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id} label={store.name}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />

            <Link
              href={posHref}
              className={cn(
                buttonVariants({ size: "sm" }),
                "h-9 min-w-9 touch-manipulation rounded-[var(--mds-radius-md)] px-2.5 shadow-[var(--mds-elevation-1)] sm:h-8 sm:px-3",
                cta.className
              )}
            >
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">{cta.label}</span>
              <span className="sm:hidden">{cta.short}</span>
            </Link>

            <Tooltip>
              <form action={logoutAction}>
                <TooltipTrigger
                  render={
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      className="hidden rounded-[var(--mds-radius-md)] text-muted-foreground hover:text-destructive sm:inline-flex"
                      aria-label={t("Sign out")}
                    />
                  }
                >
                  <LogOut className="size-4" />
                </TooltipTrigger>
              </form>
              <TooltipContent side="bottom">{t("Sign out")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

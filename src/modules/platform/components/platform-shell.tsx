"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Shield } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { logoutAction } from "@/modules/auth/actions/logout.action";
import {
  PLATFORM_NAV_GROUPS,
  getPlatformPageTitle,
  isPlatformNavActive,
  type PlatformNavItem,
} from "@/modules/platform/lib/platform-nav";

function NavLink({
  item,
  onNavigate,
}: {
  item: PlatformNavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isPlatformNavActive(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-[var(--mds-radius-md)] px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      aria-current={active ? "page" : undefined}
      title={item.description}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span className={cn("min-w-0 font-medium", active && "text-primary")}>
        {item.label}
      </span>
    </Link>
  );
}

function PlatformNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-5" aria-label="تنقل المنصة">
      {PLATFORM_NAV_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-wide text-muted-foreground uppercase">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function PlatformSidebarBrand() {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-9 items-center justify-center rounded-[var(--mds-radius-md)] bg-primary/10 text-primary">
          <Shield className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {APP_NAME}
          </p>
          <p className="text-xs text-muted-foreground">لوحة سوبر أدمن</p>
        </div>
      </div>
    </div>
  );
}

export function PlatformShell({
  adminEmail,
  adminName,
  children,
}: {
  adminEmail: string;
  adminName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = getPlatformPageTitle(pathname);

  return (
    <div className="min-h-dvh bg-[var(--mds-color-bg-canvas)]" dir="rtl">
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-[280px] shrink-0 flex-col border-e border-border bg-card lg:flex">
          <PlatformSidebarBrand />
          <ScrollArea className="flex-1 px-2 py-4">
            <PlatformNav />
          </ScrollArea>
          <div className="border-t border-border p-3">
            <div className="mb-2 truncate px-1 text-xs text-muted-foreground">
              <p className="truncate font-medium text-foreground">{adminName}</p>
              <p className="truncate" dir="ltr">
                {adminEmail}
              </p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm" className="w-full">
                <LogOut className="size-3.5" />
                تسجيل الخروج
              </Button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
            <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="lg:hidden"
                  aria-label="فتح القائمة"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="size-4" />
                </Button>
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetContent side="right" className="w-[300px] p-0">
                    <SheetHeader className="sr-only">
                      <SheetTitle>قائمة المنصة</SheetTitle>
                    </SheetHeader>
                    <PlatformSidebarBrand />
                    <ScrollArea className="h-[calc(100dvh-10rem)] px-2 py-4">
                      <PlatformNav onNavigate={() => setMobileOpen(false)} />
                    </ScrollArea>
                    <div className="border-t border-border p-3">
                      <form action={logoutAction}>
                        <Button type="submit" variant="outline" size="sm" className="w-full">
                          <LogOut className="size-3.5" />
                          تسجيل الخروج
                        </Button>
                      </form>
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-medium text-muted-foreground lg:hidden">
                    سوبر أدمن
                  </p>
                  <h1 className="truncate text-sm font-semibold tracking-tight md:text-base">
                    {pageTitle}
                  </h1>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="hidden max-w-[220px] truncate text-xs text-muted-foreground sm:inline"
                  dir="ltr"
                >
                  {adminEmail}
                </span>
                <StatusBadge />
                <form action={logoutAction} className="lg:hidden">
                  <Button type="submit" variant="outline" size="sm">
                    خروج
                  </Button>
                </form>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function StatusBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--mds-radius-pill)] border border-border bg-background px-2.5 py-1 text-[0.6875rem] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-[var(--mds-color-feedback-success)]" />
      Platform
    </span>
  );
}

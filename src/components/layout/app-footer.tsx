"use client";

import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { PoweredByHakimo } from "@/components/layout/powered-by-hakimo";

export function AppFooter() {
  const pathname = usePathname();
  const isOnlineMenu = pathname === "/menu" || pathname.startsWith("/menu/");
  // Shell/POS/print lock to the viewport — a root footer would force page scroll.
  const isAppChrome =
    pathname === "/pos" ||
    pathname.startsWith("/pos/") ||
    pathname.startsWith("/print") ||
    (!isOnlineMenu &&
      !pathname.startsWith("/login") &&
      !pathname.startsWith("/forgot-password") &&
      !pathname.startsWith("/reset-password") &&
      !pathname.startsWith("/onboarding") &&
      !pathname.startsWith("/device"));

  if (isAppChrome) {
    return null;
  }

  const year = new Date().getFullYear();

  return (
    <footer
      className={`shrink-0 border-t border-border/60 bg-background/80 px-4 pt-3 text-center backdrop-blur-xl md:px-6 ${
        isOnlineMenu
          ? "pb-[calc(env(safe-area-inset-bottom)+6.5rem)] md:pb-[calc(env(safe-area-inset-bottom)+6.5rem)]"
          : "pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-3"
      }`}
    >
      <div className="mx-auto flex max-w-lg flex-col items-center gap-1.5">
        <p className="text-xs text-muted-foreground">
          © {year} {APP_NAME}
          <span className="mx-1.5 text-border" aria-hidden>
            ·
          </span>
          جميع الحقوق محفوظة
        </p>
        <PoweredByHakimo />
      </div>
    </footer>
  );
}

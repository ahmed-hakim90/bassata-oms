"use client";

import { usePathname } from "next/navigation";

const PORTFOLIO_URL = "https://portfolio-hakim90.vercel.app/";

export function AppFooter() {
  const pathname = usePathname();
  const hideFooter = pathname === "/pos" || pathname.startsWith("/pos/");
  const isOnlineMenu = pathname === "/menu" || pathname.startsWith("/menu/");

  if (hideFooter) {
    return null;
  }

  return (
    <footer
      className={`shrink-0 rtl border-t border-border/60 bg-background/80 px-4 pt-3 text-center text-sm text-muted-foreground backdrop-blur-xl md:px-6 ${
        isOnlineMenu
          ? "pb-[calc(env(safe-area-inset-bottom)+6.5rem)] md:pb-[calc(env(safe-area-inset-bottom)+6.5rem)]"
          : "pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-3"
      }`}
    >
      <span>صنع بـ </span>
      <span> · جميع ال  حقوق محفوظة</span>
      <span> - بواسطة </span>
      <a
        href={PORTFOLIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-primary transition-colors hover:text-primary/80 hover:underline"
      >
        Hakim
      </a>
    </footer>
  );
}

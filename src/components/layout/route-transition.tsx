"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  AuthLoadingSkeleton,
  PageLoadingSkeleton,
  PosLoadingSkeleton,
} from "@/components/Velora/page-loading-skeleton";
import {
  normalizePathname,
  resolveInternalNavigationPath,
  routeLoadingKind,
} from "@/lib/route-transition";
import { cn } from "@/lib/utils";
import { useRouteTransitionStore } from "@/stores/route-transition-store";

const PENDING_TIMEOUT_MS = 12_000;

export function RouteLoadingFallback({
  path,
}: {
  path: string;
}) {
  const kind = routeLoadingKind(path);
  if (kind === "pos") return <PosLoadingSkeleton />;
  if (kind === "auth") return <AuthLoadingSkeleton />;
  return <PageLoadingSkeleton />;
}

export function RouteTransitionListener() {
  const pathname = usePathname();
  const pendingPath = useRouteTransitionStore((state) => state.pendingPath);
  const start = useRouteTransitionStore((state) => state.start);
  const clear = useRouteTransitionStore((state) => state.clear);
  const committedPathRef = useRef(pathname);

  useLayoutEffect(() => {
    committedPathRef.current = pathname;
    clear();
  }, [pathname, clear]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest("a");
      if (!(target instanceof HTMLAnchorElement)) return;

      const nextPath = resolveInternalNavigationPath({
        href: target.getAttribute("href") ?? target.href,
        currentPathname: window.location.pathname,
        origin: window.location.origin,
        target: target.getAttribute("target"),
        download: target.hasAttribute("download"),
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });
      if (nextPath) start(nextPath);
    };

    const onPopState = () => {
      const nextPath = window.location.pathname;
      if (
        normalizePathname(nextPath) ===
        normalizePathname(committedPathRef.current)
      ) {
        return;
      }
      start(nextPath, { force: true });
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [start]);

  useEffect(() => {
    if (!pendingPath) return;
    const timeoutId = window.setTimeout(() => clear(), PENDING_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [pendingPath, clear]);

  return <RouteProgressBar visible={pendingPath !== null} />;
}

function RouteProgressBar({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[calc(var(--mds-z-sticky)+8)] h-0.5 overflow-hidden bg-transparent transition-opacity duration-[var(--mds-motion-fast)]",
        visible ? "opacity-100" : "opacity-0"
      )}
      role="presentation"
      aria-hidden
    >
      <div className="velora-route-progress-bar h-full w-1/3 rounded-full bg-primary" />
    </div>
  );
}

export function RouteTransitionMain({ children }: { children: React.ReactNode }) {
  const pendingPath = useRouteTransitionStore((state) => state.pendingPath);

  return (
    <div aria-busy={pendingPath !== null}>
      {pendingPath ? <RouteLoadingFallback path={pendingPath} /> : children}
    </div>
  );
}

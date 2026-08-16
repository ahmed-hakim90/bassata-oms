"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRouteTransitionStore } from "@/stores/route-transition-store";

/**
 * App Router with instant pending UI for pathname changes.
 * Same-path search/hash updates stay silent (filters, tabs).
 */
export function useAppRouter() {
  const router = useRouter();

  return useMemo(
    () => ({
      ...router,
      push(href: string, options?: Parameters<typeof router.push>[1]) {
        useRouteTransitionStore.getState().start(href);
        router.push(href, options);
      },
      replace(href: string, options?: Parameters<typeof router.replace>[1]) {
        useRouteTransitionStore.getState().start(href);
        router.replace(href, options);
      },
    }),
    [router]
  );
}

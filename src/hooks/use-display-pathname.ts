"use client";

import { usePathname } from "next/navigation";
import { useRouteTransitionStore } from "@/stores/route-transition-store";

/** Current path, or the destination path the operator just clicked. */
export function useDisplayPathname(): string {
  const pathname = usePathname();
  const pendingPath = useRouteTransitionStore((state) => state.pendingPath);
  return pendingPath ?? pathname;
}

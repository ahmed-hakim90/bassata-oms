import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared Velora mark for shell chrome and auth screens. */
export function AppBrandMark({ className }: { className?: string }) {
  return <Store className={cn("size-5", className)} aria-hidden />;
}

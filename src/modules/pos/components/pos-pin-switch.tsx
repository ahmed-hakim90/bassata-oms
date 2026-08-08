"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions/logout.action";

interface PosPinSwitchProps {
  /** Where to land after lock — usually `/{slug}/pos`. */
  returnTo?: string;
}

/** Locks POS by signing out — next person unlocks with PIN on the slug URL. */
export function PosPinSwitch({ returnTo = "/pos" }: PosPinSwitchProps) {
  return (
    <form action={logoutAction}>
      <input type="hidden" name="next" value={returnTo} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="h-10 rounded-full px-3 max-lg:h-11 max-lg:min-w-11 max-[390px]:px-2.5"
        aria-label="قفل الشاشة"
      >
        <Lock className="size-4" />
        <span className="max-[390px]:sr-only">قفل</span>
      </Button>
    </form>
  );
}

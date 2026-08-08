"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions/logout.action";

/** Full account sign-out (used on PIN / gate screens). */
export function PosLogoutButton() {
  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="h-10 rounded-full px-3 max-lg:h-11 max-lg:min-w-11 max-[390px]:px-2.5"
        aria-label="تسجيل الخروج"
      >
        <LogOut className="size-4" />
        <span className="max-[390px]:sr-only">خروج</span>
      </Button>
    </form>
  );
}

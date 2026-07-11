"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions/logout.action";

export function PosPinSwitch() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" size="sm" className="h-10 rounded-full px-3">
        <LogOut className="size-4" />
        تبديل
      </Button>
    </form>
  );
}

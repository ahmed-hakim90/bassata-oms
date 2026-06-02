"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/auth/actions/logout.action";

export function PosPinSwitch() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" size="sm" className="rounded-full">
        <LogOut className="mr-2 size-4" />
        Switch user
      </Button>
    </form>
  );
}

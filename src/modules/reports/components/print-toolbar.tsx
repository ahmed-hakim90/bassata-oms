"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";

export function PrintToolbar() {
  const { t } = useTranslation();
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between border-b bg-white px-4 py-2 print:hidden">
      <p className="text-sm text-muted-foreground">{t("Print preview")}</p>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="me-2 size-4" />
        {t("Print")}
      </Button>
    </div>
  );
}

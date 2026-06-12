"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/use-translation";

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  dateRange?: string;
  storeName?: string | null;
}

export function ReportHeader({ title, subtitle, dateRange, storeName }: ReportHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <h2 className="font-heading text-xl font-semibold tracking-tight">{t(title)}</h2>
      {subtitle ? <p className="text-sm text-muted-foreground">{t(subtitle)}</p> : null}
      <div className="flex flex-wrap gap-2">
        {dateRange ? <Badge variant="secondary">{dateRange}</Badge> : null}
        {storeName ? <Badge variant="outline">{storeName}</Badge> : null}
      </div>
    </div>
  );
}

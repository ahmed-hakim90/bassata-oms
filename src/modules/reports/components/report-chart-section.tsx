"use client";

import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

interface ReportChartSectionProps {
  title: string;
  description?: string;
  height?: number;
  children: React.ReactNode;
}

export function ReportChartSection({
  title,
  description,
  height = 280,
  children,
}: ReportChartSectionProps) {
  const { t } = useTranslation();
  const useResponsiveDefault = height === 280;
  return (
    <OperationalCard title={t(title)} description={description ? t(description) : undefined}>
      <div
        className={cn("print:hidden", useResponsiveDefault && "h-[200px] sm:h-[280px]")}
        style={useResponsiveDefault ? undefined : { height }}
      >
        {children}
      </div>
    </OperationalCard>
  );
}

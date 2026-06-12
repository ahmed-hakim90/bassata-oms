"use client";

import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { useTranslation } from "@/lib/i18n/use-translation";

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
  return (
    <OperationalCard title={t(title)} description={description ? t(description) : undefined}>
      <div className="print:hidden" style={{ height }}>
        {children}
      </div>
    </OperationalCard>
  );
}

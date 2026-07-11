"use client";

import { PageHeader } from "@/components/SweetFlow/page-header";
import { cn } from "@/lib/utils";

interface ReportPageProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ReportPage({
  title,
  description,
  actions,
  filters,
  children,
  className,
}: ReportPageProps) {
  return (
    <div className={cn("flex flex-col gap-[var(--mds-space-6)]", className)} dir="rtl">
      <PageHeader
        breadcrumb={<span>التقارير</span>}
        title={title}
        description={description}
        action={actions}
      />
      {filters ? (
        <div className="print:hidden rounded-[var(--mds-radius-lg)] border border-border bg-card p-[var(--mds-space-4)] shadow-[var(--mds-elevation-1)]">
          {filters}
        </div>
      ) : null}
      {children}
    </div>
  );
}

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
    <div className={cn("space-y-6", className)}>
      <PageHeader title={title} description={description} action={actions} />
      {filters ? <div className="print:hidden">{filters}</div> : null}
      {children}
    </div>
  );
}

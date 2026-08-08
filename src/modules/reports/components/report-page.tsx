"use client";

import Link from "next/link";
import { PageHeader } from "@/components/Velora/page-header";
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
        breadcrumb={
          <Link href="/reports" className="text-primary hover:underline">
            التقارير
          </Link>
        }
        title={title}
        description={description}
        action={actions}
      />
      {filters ? <div className="print:hidden min-w-0">{filters}</div> : null}
      {children}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/SweetFlow/page-header";
import type { MonthlyClose, Store } from "@/lib/types";
import { ClosingWizard } from "./closing-wizard";

interface ClosingPageProps {
  closings: MonthlyClose[];
  stores: Store[];
  storeId: string;
  currency: string;
}

export function ClosingPage(props: ClosingPageProps) {
  const router = useRouter();
  return (
    <>
      <PageHeader
        title="Monthly Closing"
        description="Generate snapshots and lock accounting periods"
      />
      <ClosingWizard
        {...props}
        defaultStoreId={props.storeId}
        onRefresh={() => router.refresh()}
      />
    </>
  );
}

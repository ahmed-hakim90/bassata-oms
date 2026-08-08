"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/SweetFlow/page-header";
import type { MonthlyClose, Store } from "@/lib/types";
import { AccountingSubnav } from "@/modules/accounting/components/accounting-subnav";
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
        title="الإقفال الشهري"
        description="ولّد ملخص الفترة، راجع الأرقام، وقفّل الفترة عشان تمنع التعديل على البيع والمخزون والقيود"
      />
      <div className="mb-4">
        <AccountingSubnav />
      </div>
      <ClosingWizard
        {...props}
        defaultStoreId={props.storeId}
        onRefresh={() => router.refresh()}
      />
    </>
  );
}

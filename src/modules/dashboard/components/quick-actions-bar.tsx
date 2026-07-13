"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Clock,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SupplierListSummary } from "@/lib/types";
import { getSuppliersPageDataAction } from "@/modules/suppliers/actions/supplier.actions";
import { RecordPaymentDialog } from "@/modules/suppliers/components/record-payment-dialog";

const linkActions = [
  {
    href: "/pos",
    label: "نقطة البيع",
    icon: ShoppingCart,
    className: "text-[var(--mds-color-feedback-success)]",
  },
  {
    href: "/sessions",
    label: "الجلسات",
    icon: Clock,
    className: "text-[var(--mds-color-feedback-info)]",
  },
  {
    href: "/orders",
    label: "الطلبات",
    icon: Receipt,
    className: "text-[var(--mds-color-action-primary)]",
  },
  {
    href: "/expenses",
    label: "المصروفات",
    icon: Wallet,
    className: "text-[var(--mds-color-feedback-warning)]",
  },
];

const chipClassName =
  "inline-flex items-center gap-2 rounded-[var(--mds-radius-lg)] bg-card px-4 py-3 text-sm font-medium text-card-foreground shadow-[var(--mds-elevation-1)] ring-1 ring-border transition hover:bg-muted hover:shadow-[var(--mds-elevation-2)]";

export function QuickActionsBar() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showPayment, setShowPayment] = useState(false);
  const [summaries, setSummaries] = useState<SupplierListSummary[]>([]);
  const [currency, setCurrency] = useState("EGP");
  const [canManagePayments, setCanManagePayments] = useState(false);

  const openSupplierPayment = () => {
    startTransition(async () => {
      try {
        const data = await getSuppliersPageDataAction();
        if (!data.canManagePayments) {
          toast.error("تسجيل دفعة المورد متاح للمالك أو المدير فقط");
          return;
        }
        if (data.summaries.length === 0) {
          toast.error("أضف موردًا أولاً من صفحة الموردين");
          return;
        }
        setSummaries(data.summaries);
        setCurrency(data.currency);
        setCanManagePayments(true);
        setShowPayment(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "تعذر تحميل الموردين");
      }
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {linkActions.map(({ href, label, icon: Icon, className }) => (
          <Link key={href} href={href} className={chipClassName}>
            <Icon className={cn("size-4", className)} />
            {label}
          </Link>
        ))}
        <button
          type="button"
          className={cn(chipClassName, "cursor-pointer disabled:opacity-60")}
          onClick={openSupplierPayment}
          disabled={pending}
        >
          <Banknote className="size-4 text-[var(--mds-color-feedback-warning)]" />
          دفعة مورد
        </button>
      </div>

      {canManagePayments ? (
        <RecordPaymentDialog
          open={showPayment}
          onOpenChange={setShowPayment}
          suppliers={summaries}
          currency={currency}
          onSuccess={() => {
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

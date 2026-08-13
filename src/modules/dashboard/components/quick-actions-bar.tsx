"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Clock,
  FilePlus2,
  Receipt,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { CompactAction, CompactActions } from "@/components/Velora/compact-actions";
import type { SupplierListSummary } from "@/lib/types";
import { getSuppliersPageDataAction } from "@/modules/suppliers/actions/supplier.actions";
import { RecordPaymentDialog } from "@/modules/suppliers/components/record-payment-dialog";
import { quickCreateSalesInvoiceAction } from "@/modules/sales-invoices/actions/sales-invoice.actions";

const linkActions = [
  {
    href: "/pos",
    label: "نقطة البيع",
    icon: ShoppingCart,
  },
  {
    href: "/sessions",
    label: "الجلسات",
    icon: Clock,
  },
  {
    href: "/orders",
    label: "الطلبات",
    icon: Receipt,
  },
  {
    href: "/expenses",
    label: "المصروفات",
    icon: Wallet,
  },
];

export function QuickActionsBar({
  enableWholesaleSales = false,
}: {
  enableWholesaleSales?: boolean;
}) {
  const router = useRouter();
  const [salesPending, startSales] = useTransition();
  const [showPayment, setShowPayment] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [summaries, setSummaries] = useState<SupplierListSummary[]>([]);
  const [currency, setCurrency] = useState("EGP");

  const openSupplierPayment = () => {
    // Open immediately — load suppliers in the background.
    setShowPayment(true);
    setPaymentLoading(true);
    void (async () => {
      try {
        const data = await getSuppliersPageDataAction();
        if (!data.canManagePayments) {
          setShowPayment(false);
          toast.error("تسجيل دفعة المورد متاح للمالك أو المدير فقط");
          return;
        }
        if (data.summaries.length === 0) {
          setShowPayment(false);
          toast.error("أضف موردًا أولاً من صفحة الموردين");
          return;
        }
        setSummaries(data.summaries);
        setCurrency(data.currency);
      } catch (e) {
        setShowPayment(false);
        toast.error(e instanceof Error ? e.message : "تعذر تحميل الموردين");
      } finally {
        setPaymentLoading(false);
      }
    })();
  };

  const quickCreateSalesInvoice = () => {
    startSales(async () => {
      const result = await quickCreateSalesInvoiceAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("اتعملت مسودة فاتورة جملة");
      router.push(`/sales-invoices?open=${result.data.id}`);
    });
  };

  return (
    <>
      <CompactActions className="justify-start">
        {linkActions.map(({ href, label, icon }) => (
          <CompactAction key={href} label={label} icon={icon} href={href} />
        ))}
        {enableWholesaleSales ? (
          <CompactAction
            label="فاتورة بيع"
            icon={FilePlus2}
            disabled={salesPending}
            onClick={quickCreateSalesInvoice}
          />
        ) : null}
        <CompactAction
          label="دفعة مورد"
          icon={Banknote}
          onClick={openSupplierPayment}
        />
      </CompactActions>

      <RecordPaymentDialog
        open={showPayment}
        onOpenChange={(open) => {
          setShowPayment(open);
          if (!open) setPaymentLoading(false);
        }}
        suppliers={summaries}
        currency={currency}
        loading={paymentLoading}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}

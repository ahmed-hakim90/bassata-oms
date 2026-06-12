"use client";

import Link from "next/link";
import {
  BarChart3,
  Barcode,
  CircleDollarSign,
  Clock,
  TrendingUp,
  Wallet,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { useTranslation } from "@/lib/i18n/use-translation";

const REPORT_LINKS = [
  { href: "/reports/sales", label: "Sales", icon: TrendingUp, description: "Revenue, orders, and trends" },
  { href: "/reports/sessions", label: "Sessions", icon: Clock, description: "Cash reconciliation and variance" },
  { href: "/reports/profit", label: "Profit", icon: CircleDollarSign, description: "Margins, COGS, and net profit" },
  { href: "/reports/inventory", label: "Inventory", icon: Warehouse, description: "Valuation, batches, and expiry" },
  { href: "/reports/expenses", label: "Expenses", icon: Wallet, description: "Operating expenses by category" },
  { href: "/labels", label: "Barcode Labels", icon: Barcode, description: "Print product sticker labels" },
] as const;

interface ReportsHubProps {
  showProfit: boolean;
  showFinancial: boolean;
  overview?: React.ReactNode;
  children?: React.ReactNode;
}

export function ReportsHub({ showProfit, showFinancial, overview, children }: ReportsHubProps) {
  const { t } = useTranslation();
  const links = REPORT_LINKS.filter((link) => {
    if (link.href === "/reports/profit" && !showProfit) return false;
    if (link.href === "/reports/expenses" && !showFinancial) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Reports"
        description="Executive insights, exports, and print layouts"
      />
      {overview ?? children}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <OperationalCard title={t(link.label)} description={t(link.description)}>
                <div className="flex items-center gap-3 text-primary">
                  <Icon className="size-5" />
                  <span className="text-sm font-medium">{t("Open report")}</span>
                </div>
              </OperationalCard>
            </Link>
          );
        })}
        <OperationalCard title={t("Overview dashboard")} description={t("Legacy executive KPI dashboard")}>
          <div className="flex items-center gap-3 text-primary">
            <BarChart3 className="size-5" />
            <span className="text-sm text-muted-foreground">{t("Charts below")}</span>
          </div>
        </OperationalCard>
      </div>
    </>
  );
}

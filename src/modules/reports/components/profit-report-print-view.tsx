import { PrintableDocument } from "@/modules/reports/components/printable-document";
import { formatCurrency } from "@/lib/format";
import type { ReportBranding } from "@/modules/reports/core/report-context";

export interface ProfitReportPrintData {
  profit: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    totalExpenses: number;
    wasteCost: number;
    estimatedNetProfit: number;
    avgOrderProfit: number;
    inventory: {
      inventorySellValue: number;
      inventoryCostValue: number;
      inventoryExpectedProfit: number;
    };
    byDay: Array<{
      date: string;
      orders: number;
      revenue: number;
      profit: number;
    }>;
    invoices: Array<{
      orderId: string;
      orderNumber: string;
      revenue: number;
      cost: number;
      profit: number;
    }>;
    purchaseInvoices: Array<{
      invoiceId: string;
      invoiceNumber: string;
      purchaseCost: number;
      expectedSellValue: number;
      expectedProfit: number;
    }>;
  };
  rankings: {
    highestProfit: Array<{
      productId: string;
      name: string;
      profit: number;
      margin: number;
    }>;
    highestSelling: Array<{
      productId: string;
      name: string;
      revenue: number;
      profit: number;
    }>;
  };
  context: ReportBranding & {
    filterSummary?: string;
    generatedBy: string;
    generatedAt: string;
  };
  currency: string;
}

export function ProfitReportPrintView({ profit, rankings, context, currency }: ProfitReportPrintData) {
  const summaryRows = [
    ["الإيراد", profit.revenue],
    ["تكلفة البضاعة", profit.cogs],
    ["إجمالي الربح", profit.grossProfit],
    ["المصروفات", profit.totalExpenses],
    ["تكلفة الهالك", profit.wasteCost],
    ["صافي الربح", profit.estimatedNetProfit],
    ["متوسط ربح الفاتورة", profit.avgOrderProfit],
    ["مخزون — قيمة البيع", profit.inventory.inventorySellValue],
    ["مخزون — تكلفة الشراء", profit.inventory.inventoryCostValue],
    ["مخزون — ربح متوقع", profit.inventory.inventoryExpectedProfit],
  ] as const;

  return (
    <PrintableDocument
      branding={context}
      title="تقرير الأرباح"
      dateRange={context.filterSummary}
      generatedBy={context.generatedBy}
      generatedAt={context.generatedAt}
    >
      <table className="mb-6 w-full text-sm">
        <tbody>
          {summaryRows.map(([label, value]) => (
            <tr key={label} className="border-b">
              <td className="py-2 font-medium">{label}</td>
              <td className="py-2 text-end">{formatCurrency(value, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 text-base font-semibold">أعلى أصناف ربحًا</h2>
      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="border-b text-start">
            <th className="py-1 font-medium">الصنف</th>
            <th className="py-1 text-end font-medium">الربح</th>
            <th className="py-1 text-end font-medium">الهامش</th>
          </tr>
        </thead>
        <tbody>
          {rankings.highestProfit.map((p) => (
            <tr key={p.productId} className="border-b">
              <td className="py-1">{p.name}</td>
              <td className="py-1 text-end">{formatCurrency(p.profit, currency)}</td>
              <td className="py-1 text-end">{p.margin.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 text-base font-semibold">أعلى أصناف بيعًا</h2>
      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="border-b text-start">
            <th className="py-1 font-medium">الصنف</th>
            <th className="py-1 text-end font-medium">المبيعات</th>
            <th className="py-1 text-end font-medium">الربح</th>
          </tr>
        </thead>
        <tbody>
          {rankings.highestSelling.map((p) => (
            <tr key={p.productId} className="border-b">
              <td className="py-1">{p.name}</td>
              <td className="py-1 text-end">{formatCurrency(p.revenue, currency)}</td>
              <td className="py-1 text-end">{formatCurrency(p.profit, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 text-base font-semibold">الربح حسب اليوم</h2>
      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="border-b text-start">
            <th className="py-1 font-medium">اليوم</th>
            <th className="py-1 text-end font-medium">فواتير</th>
            <th className="py-1 text-end font-medium">مبيعات</th>
            <th className="py-1 text-end font-medium">ربح</th>
          </tr>
        </thead>
        <tbody>
          {profit.byDay.map((d) => (
            <tr key={d.date} className="border-b">
              <td className="py-1">{d.date}</td>
              <td className="py-1 text-end">{d.orders}</td>
              <td className="py-1 text-end">{formatCurrency(d.revenue, currency)}</td>
              <td className="py-1 text-end">{formatCurrency(d.profit, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 text-base font-semibold">الربح المتوقع لكل فاتورة بيع</h2>
      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="border-b text-start">
            <th className="py-1 font-medium">الفاتورة</th>
            <th className="py-1 text-end font-medium">المبيعات</th>
            <th className="py-1 text-end font-medium">التكلفة</th>
            <th className="py-1 text-end font-medium">الربح</th>
          </tr>
        </thead>
        <tbody>
          {profit.invoices.map((inv) => (
            <tr key={inv.orderId} className="border-b">
              <td className="py-1">{inv.orderNumber}</td>
              <td className="py-1 text-end">{formatCurrency(inv.revenue, currency)}</td>
              <td className="py-1 text-end">{formatCurrency(inv.cost, currency)}</td>
              <td className="py-1 text-end">{formatCurrency(inv.profit, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 text-base font-semibold">الربح المتوقع لكل فاتورة شراء</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-start">
            <th className="py-1 font-medium">الفاتورة</th>
            <th className="py-1 text-end font-medium">تكلفة الشراء</th>
            <th className="py-1 text-end font-medium">قيمة البيع المتوقعة</th>
            <th className="py-1 text-end font-medium">الربح المتوقع</th>
          </tr>
        </thead>
        <tbody>
          {profit.purchaseInvoices.map((inv) => (
            <tr key={inv.invoiceId} className="border-b">
              <td className="py-1">{inv.invoiceNumber}</td>
              <td className="py-1 text-end">
                {formatCurrency(inv.purchaseCost, currency)}
              </td>
              <td className="py-1 text-end">
                {formatCurrency(inv.expectedSellValue, currency)}
              </td>
              <td className="py-1 text-end">
                {formatCurrency(inv.expectedProfit, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}

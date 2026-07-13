import { getReplenishmentReportPageData } from "@/modules/reports/actions/replenishment-report.actions";
import { PrintableDocument } from "@/modules/reports/components/printable-document";

export default async function PrintReplenishmentReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getReplenishmentReportPageData(params);
  const r = data.report;

  return (
    <PrintableDocument
      branding={data.context}
      title="خطة الشراء من المبيعات"
      dateRange={r.monthLabel}
      generatedBy={data.context.generatedBy}
      generatedAt={data.context.generatedAt}
      filterSummary={`تغطية ${r.coverageMonths} شهر · ${r.orderCount} طلب`}
    >
      <table className="mb-6 w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-2 font-medium">شهر الأساس</td>
            <td className="py-2 text-end">{r.monthLabel}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">التغطية</td>
            <td className="py-2 text-end">{r.coverageMonths} شهر</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-medium">محتاج شراء</td>
            <td className="py-2 text-end">{r.summary.needBuyCount}</td>
          </tr>
        </tbody>
      </table>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 text-start">الصنف</th>
            <th className="py-2 text-end">استهلاك</th>
            <th className="py-2 text-end">مطلوب</th>
            <th className="py-2 text-end">رصيد</th>
            <th className="py-2 text-end">شراء</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.productId} className="border-b">
              <td className="py-2">{row.productName}</td>
              <td className="py-2 text-end tabular-nums">{row.monthUsage}</td>
              <td className="py-2 text-end tabular-nums">{row.requiredQty}</td>
              <td className="py-2 text-end tabular-nums">{row.onHand}</td>
              <td className="py-2 text-end tabular-nums font-medium">
                {row.suggestedBuy}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintableDocument>
  );
}

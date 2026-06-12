import { getExpensesReportPageData } from "@/modules/reports/actions/expenses-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { ExpensesReportView } from "@/modules/reports/components/expenses-report-view";

export default async function ExpensesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getExpensesReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <ExpensesReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}

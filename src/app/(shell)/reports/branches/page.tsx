import { getBranchesReportPageData } from "@/modules/reports/actions/executive-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { BranchesReportView } from "@/modules/reports/components/branches-report-view";

export default async function BranchesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getBranchesReportPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <BranchesReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}

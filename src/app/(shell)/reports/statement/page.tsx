import { getPartyStatementPageData } from "@/modules/reports/actions/party-statement-report.actions";
import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { PartyStatementReportView } from "@/modules/reports/components/party-statement-report-view";

export default async function PartyStatementReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [data, caps] = await Promise.all([
    getPartyStatementPageData(params),
    getReportCapabilities(),
  ]);
  return (
    <PartyStatementReportView
      {...data}
      canPrint={caps.canPrint}
      canExcel={caps.canExcel}
      canPdf={caps.canPdf}
    />
  );
}

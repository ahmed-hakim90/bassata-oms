import { notFound } from "next/navigation";
import { AccessDenied } from "@/components/Velora/access-denied";
import { requirePageAuth, runPageAuth } from "@/lib/auth/page-guard";
import { getReportBranding } from "@/modules/reports/services/report-branding.service";
import { getCountSessionPrintData } from "@/modules/stock-count/actions/count.actions";
import { StockCountPrintView } from "@/modules/stock-count/components/stock-count-print-view";

export default async function PrintStockCountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requirePageAuth("/print/stock-count");
  if (!auth.ok) {
    return <AccessDenied title={auth.denial.title} description={auth.denial.description} />;
  }

  const { id } = await params;
  const dataResult = await runPageAuth(
    () => getCountSessionPrintData(id),
    "/print/stock-count"
  );
  if (!dataResult.ok) {
    return (
      <AccessDenied
        title={dataResult.denial.title}
        description={dataResult.denial.description}
      />
    );
  }
  const data = dataResult.data;
  if (!data) notFound();

  const branding = await getReportBranding(data.sheet.storeId);
  const statusLabel =
    data.sheet.status === "completed"
      ? "مكتمل"
      : data.sheet.status === "approved"
        ? "معتمد"
        : data.sheet.status === "pending_approval"
          ? "بانتظار الاعتماد"
          : "جارٍ العد";

  return (
    <StockCountPrintView
      title="تقرير جرد المخزون"
      subtitle={`جرد ${data.sheet.countId.slice(0, 8)} · ${statusLabel}`}
      filterSummary={`فرع: ${data.sheet.storeName} · مخزن: ${data.sheet.warehouseName}`}
      groups={data.sheet.groups}
      lines={data.sheet.lines}
      truncated={data.sheet.truncated}
      blankCounted={false}
      branding={branding}
      userName={data.generatedBy}
    />
  );
}

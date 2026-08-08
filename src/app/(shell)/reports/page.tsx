import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { ReportsHub } from "@/modules/reports/components/reports-hub";

export default async function ReportsRoute() {
  const caps = await getReportCapabilities();
  const canManageSchedule =
    caps.role === "owner" ||
    caps.role === "manager" ||
    caps.permissions.has("settings_manage");

  return (
    <ReportsHub
      showProfit={caps.canViewProfit}
      showFinancial={caps.canViewFinancial}
      canManageSchedule={canManageSchedule}
    />
  );
}

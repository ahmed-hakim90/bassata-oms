import { getReportCapabilities } from "@/modules/reports/actions/report-access.actions";
import { ReportsHub } from "@/modules/reports/components/reports-hub";
import { getFeatureFlags } from "@/modules/system/services/settings.service";

export default async function ReportsRoute() {
  const [caps, flags] = await Promise.all([
    getReportCapabilities(),
    getFeatureFlags(),
  ]);
  const canManageSchedule =
    caps.role === "owner" ||
    caps.role === "manager" ||
    caps.permissions.has("settings_manage");

  return (
    <ReportsHub
      showProfit={caps.canViewProfit}
      showFinancial={caps.canViewFinancial}
      showCustomerDebt={flags.credit_sales === true}
      canManageSchedule={canManageSchedule}
    />
  );
}

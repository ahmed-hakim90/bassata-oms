import { getCurrentUser } from "@/lib/auth/session";
import { getEffectivePermissions } from "@/lib/repositories/permission.repository";
import { getUnifiedSettingsData } from "@/modules/system/actions/system.actions";
import { SettingsShell } from "@/modules/system/components/settings/settings-shell";
import type { PermissionKey } from "@/lib/constants";

export default async function SettingsRoute({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    storeId?: string;
    userId?: string;
    action?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const permissions = await getEffectivePermissions(user);
  const isOwner = user.role === "owner";
  const page = Number(params.page ?? 1);

  const data = await getUnifiedSettingsData(permissions, {
    isOwner,
    tab: params.tab,
    auditFilters: {
      storeId: params.storeId,
      userId: params.userId,
      action: params.action,
      from: params.from,
      to: params.to,
      page: Number.isFinite(page) ? page : 1,
    },
  });

  const has = (key: PermissionKey) => isOwner || permissions.has(key);

  return (
    <SettingsShell
      activeTab={data.activeTab}
      visibleTabs={data.visibleTabs.map((t) => ({
        id: t.id,
        label: t.label,
        group: t.group,
        searchTerms: t.searchTerms,
      }))}
      canManageSettings={has("settings_manage")}
      canManageSessions={has("settings_manage") || has("session_settings_manage")}
      canManageExpenseSettings={has("settings_manage")}
      canManageCostCenters={has("cost_center_manage")}
      receiptFooter={data.receiptFooter}
      settingsBundle={data.settingsBundle}
      sessionSettings={data.sessionSettings}
      featureFlags={data.featureFlags}
      usersBundle={data.usersBundle}
      costCentersBundle={data.costCentersBundle}
      auditBundle={data.auditBundle}
      souqnaBundle={data.souqnaBundle}
    />
  );
}

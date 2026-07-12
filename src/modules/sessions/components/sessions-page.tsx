import { getValidatedActiveStoreId } from "@/lib/auth/guards";
import {
  getActiveCashierId,
  getCurrentUser,
  getRegisteredDeviceContext,
} from "@/lib/auth/session";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as permissionRepo from "@/lib/repositories/permission.repository";
import { listDevices } from "@/modules/system/services/users.service";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { OpenSessionDialog } from "@/modules/sessions/components/open-session-dialog";
import { CloseSessionStepper } from "@/modules/sessions/components/close-session-stepper";
import { OpenSessionsTable } from "@/modules/sessions/components/open-sessions-table";
import { ClosedSessionsTable } from "@/modules/sessions/components/closed-sessions-table";
import { SessionLifecycleBadge } from "@/modules/sessions/components/session-lifecycle-badge";
import { CashierVaultPanel } from "@/modules/sessions/components/cashier-vault-panel";
import { OperationalCard } from "@/components/SweetFlow/operational-card";
import { calcExpectedCash } from "@/modules/sessions/services/reconciliation.service";
import { getOpenSessionSummaries } from "@/modules/sessions/services/open-session-summary.service";
import {
  listSessions,
  getActiveSession,
} from "@/modules/sessions/services/session.service";
import { listStoreCashierVaults } from "@/modules/sessions/services/cashier-vault.service";
import { listExpenses } from "@/modules/expenses/services/expense.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";
import { computeSessionLifecycle } from "@/modules/sessions/services/session-lifecycle.service";
import { listCostCenters } from "@/modules/accounting/services/cost-center.service";
import { listExpenseCategories } from "@/modules/accounting/services/expense-category.service";
import { SessionsStoreFilter } from "@/modules/sessions/components/sessions-store-filter";

interface SessionsPageProps {
  filterStoreId?: string;
}

export async function SessionsPage({ filterStoreId = "all" }: SessionsPageProps) {
  const storeId = await getValidatedActiveStoreId();
  const canViewAll = await permissionRepo.hasPermission("session_view_all");
  const canForceClose = await permissionRepo.hasPermission("session_force_close");
  const user = await getCurrentUser();
  const canManageVault = user?.role === "owner" || user?.role === "manager";
  const deviceCtx = await getRegisteredDeviceContext();
  const cashierId =
    user && deviceCtx?.storeId === storeId
      ? await getActiveCashierId(storeId, deviceCtx.deviceId, user)
      : null;

  const vaultStoreId =
    canViewAll && filterStoreId !== "all" ? filterStoreId : storeId;

  const [
    sessions,
    active,
    stores,
    users,
    devices,
    sessionSettings,
    costCenters,
    categories,
    vaultRows,
  ] = await Promise.all([
    listSessions(canViewAll ? undefined : storeId),
    cashierId ? getActiveSession(storeId, cashierId) : null,
    storeRepo.listStores(),
    userRepo.listUsers(),
    listDevices(),
    getSessionSettings(),
    listCostCenters(storeId),
    listExpenseCategories(),
    canManageVault || user?.role === "cashier"
      ? listStoreCashierVaults(vaultStoreId)
      : Promise.resolve([]),
  ]);

  const filteredStoreId =
    canViewAll && filterStoreId !== "all" && stores.some((s) => s.id === filterStoreId)
      ? filterStoreId
      : null;
  const scopedSessions = filteredStoreId
    ? sessions.filter((s) => s.store_id === filteredStoreId)
    : canViewAll
      ? sessions
      : sessions.filter((s) => s.store_id === storeId);

  const storeMap = Object.fromEntries(stores.map((s) => [s.id, s.name]));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d.name]));
  const costCenterMap = Object.fromEntries(costCenters.map((c) => [c.id, c.name]));
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const openSummaries = await getOpenSessionSummaries({
    storeId: canViewAll ? (filteredStoreId ?? undefined) : storeId,
    storeMap: new Map(Object.entries(storeMap)),
    userMap: new Map(Object.entries(userMap)),
    deviceMap: new Map(Object.entries(deviceMap)),
  });

  const closedSessions = scopedSessions
    .filter((s) => s.status === "closed")
    .sort((a, b) => {
      const aTime = a.closed_at ?? a.opened_at;
      const bTime = b.closed_at ?? b.opened_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  const closedRows = closedSessions.map((s) => ({
    session: s,
    storeName: storeMap[s.store_id] ?? "—",
    cashierName: userMap[s.cashier_id] ?? "الكاشير",
    closedByName: s.closed_by ? (userMap[s.closed_by] ?? null) : null,
    deviceName: s.device_id ? (deviceMap[s.device_id] ?? null) : null,
  }));

  const [reconciliation, sessionExpenses] = active
    ? await Promise.all([calcExpectedCash(active.id), listExpenses(storeId, active.id)])
    : [null, []];

  const activeLifecycle = active
    ? computeSessionLifecycle(active, sessionSettings)
    : null;

  const visibleVaultRows = canManageVault
    ? vaultRows
    : vaultRows.filter((row) => row.cashierId === (cashierId ?? user?.id));

  return (
    <div className="flex flex-col gap-[var(--mds-space-6)]">
      <PageHeader
        breadcrumb={<span>المبيعات · الجلسات</span>}
        title="جلسات الكاشير"
        description={
          canViewAll
            ? "الجلسات المفتوحة على كل الفروع — راقب وافتح إغلاق إجباري عند الحاجة"
            : "افتح واقفل جلستك وعدّ الدرج قبل ما تمشي"
        }
        action={
          <OpenSessionDialog
            disabled={Boolean(active)}
            canEditOpeningFloat={canManageVault}
            lockOpeningFloat={!canManageVault}
          />
        }
      />

      <div className="grid gap-[var(--mds-space-4)] sm:grid-cols-3">
        <OperationalCard
          title="مفتوحة الآن"
          value={String(openSummaries.length)}
          subtitle={canViewAll ? "كل الفروع أو الفلتر الحالي" : "فرعك"}
          accent="var(--mds-color-feedback-success)"
        />
        <OperationalCard
          title="جلسة الجهاز"
          value={active ? "نشطة" : "لا توجد"}
          subtitle={
            active
              ? (userMap[active.cashier_id] ?? "الكاشير")
              : "افتح جلسة للبيع"
          }
        />
        <OperationalCard
          title="مقفولة"
          value={String(closedRows.length)}
          subtitle="سجل الجلسات المغلقة"
          accent="var(--mds-color-feedback-info)"
        />
      </div>

      {(canManageVault || visibleVaultRows.length > 0) && (
        <CashierVaultPanel
          storeId={vaultStoreId}
          storeName={storeMap[vaultStoreId] ?? "الفرع"}
          rows={visibleVaultRows}
          canManage={Boolean(canManageVault)}
        />
      )}

      <section className="flex flex-col gap-[var(--mds-space-3)]">
        <div className="flex flex-wrap items-center justify-between gap-[var(--mds-space-3)]">
          <h2 className="font-heading text-base font-semibold">
            الجلسات المفتوحة ({openSummaries.length})
          </h2>
          {canViewAll ? (
            <SessionsStoreFilter
              stores={stores}
              value={filteredStoreId ?? "all"}
            />
          ) : null}
        </div>
        <OpenSessionsTable
          summaries={openSummaries}
          currentCashierId={cashierId}
          canForceClose={canForceClose}
          allowManagerForceClose={sessionSettings.allow_manager_force_close}
          showStoreColumn={canViewAll}
        />
      </section>

      {active && reconciliation && activeLifecycle && (
        <section className="flex flex-col gap-[var(--mds-space-3)]">
          <div className="flex items-center gap-[var(--mds-space-3)]">
            <h2 className="font-heading text-base font-semibold">اقفل جلستك</h2>
            <SessionLifecycleBadge lifecycle={activeLifecycle.lifecycle} />
          </div>
          <CloseSessionStepper
            session={active}
            reconciliation={reconciliation}
            sessionExpenses={sessionExpenses}
            cashierName={userMap[active.cashier_id] ?? "الكاشير"}
            costCenterMap={costCenterMap}
            categoryMap={categoryMap}
          />
        </section>
      )}

      <section className="flex flex-col gap-[var(--mds-space-3)]">
        <h2 className="font-heading text-base font-semibold">
          الجلسات المقفولة ({closedRows.length})
        </h2>
        <ClosedSessionsTable rows={closedRows} showStoreColumn={canViewAll} />
      </section>
    </div>
  );
}

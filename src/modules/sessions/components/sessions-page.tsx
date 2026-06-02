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
import { Badge } from "@/components/ui/badge";
import { OpenSessionDialog } from "@/modules/sessions/components/open-session-dialog";
import { CloseSessionStepper } from "@/modules/sessions/components/close-session-stepper";
import { OpenSessionsTable } from "@/modules/sessions/components/open-sessions-table";
import { SessionLifecycleBadge } from "@/modules/sessions/components/session-lifecycle-badge";
import { calcExpectedCash } from "@/modules/sessions/services/reconciliation.service";
import { getOpenSessionSummaries } from "@/modules/sessions/services/open-session-summary.service";
import {
  listSessions,
  getActiveSession,
} from "@/modules/sessions/services/session.service";
import { listExpenses } from "@/modules/expenses/services/expense.service";
import { getSessionSettings } from "@/modules/system/services/settings.service";
import { computeSessionLifecycle } from "@/modules/sessions/services/session-lifecycle.service";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";
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
  const deviceCtx = await getRegisteredDeviceContext();
  const cashierId =
    user && deviceCtx?.storeId === storeId
      ? await getActiveCashierId(storeId, deviceCtx.deviceId, user)
      : null;

  const [sessions, active, stores, users, devices, sessionSettings, costCenters, categories] =
    await Promise.all([
      listSessions(canViewAll ? undefined : storeId),
      cashierId ? getActiveSession(storeId, cashierId) : null,
      storeRepo.listStores(),
      userRepo.listUsers(),
      listDevices(),
      getSessionSettings(),
      listCostCenters(storeId),
      listExpenseCategories(),
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

  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const deviceMap = new Map(devices.map((d) => [d.id, d.name]));
  const costCenterMap = new Map(costCenters.map((c) => [c.id, c.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const openSummaries = await getOpenSessionSummaries({
    storeId: canViewAll ? (filteredStoreId ?? undefined) : storeId,
    storeMap,
    userMap,
    deviceMap,
  });

  const closedSessions = scopedSessions.filter((s) => s.status === "closed");

  const [reconciliation, sessionExpenses] = active
    ? await Promise.all([calcExpectedCash(active.id), listExpenses(storeId, active.id)])
    : [null, []];

  const activeLifecycle = active
    ? computeSessionLifecycle(active, sessionSettings)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title="Cashier sessions"
          description={
            canViewAll
              ? "Live open sessions across branches"
              : "Open, close, and reconcile branch sessions"
          }
        />
        <OpenSessionDialog disabled={Boolean(active)} />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold">
            Open sessions ({openSummaries.length})
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
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-base font-semibold">Close your session</h2>
            <SessionLifecycleBadge lifecycle={activeLifecycle.lifecycle} />
          </div>
          <CloseSessionStepper
            session={active}
            reconciliation={reconciliation}
            sessionExpenses={sessionExpenses}
            cashierName={userMap.get(active.cashier_id) ?? "Cashier"}
            costCenterMap={costCenterMap}
            categoryMap={categoryMap}
          />
        </section>
      )}

      <details className="rounded-2xl bg-white ring-1 ring-black/5">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          Closed session history ({closedSessions.length})
        </summary>
        <ul className="space-y-0 border-t border-black/5">
          {closedSessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between border-b border-black/5 px-4 py-3 last:border-0"
            >
              <div>
                <p className="font-medium">
                  {canViewAll ? `${storeMap.get(s.store_id)} · ` : ""}
                  {userMap.get(s.cashier_id)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(s.opened_at), "MMM d, h:mm a")}
                  {s.closed_at
                    ? ` → ${format(new Date(s.closed_at), "MMM d, h:mm a")}`
                    : ""}
                </p>
                {s.force_closed && s.close_reason ? (
                  <p className="mt-1 text-xs text-destructive">
                    Force closed: {s.close_reason}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <Badge variant={s.force_closed ? "destructive" : "secondary"}>
                  {s.force_closed ? "force closed" : s.status}
                </Badge>
                {s.variance != null && (
                  <p className="mt-1 text-xs tabular-nums">
                    Variance {formatCurrency(s.variance)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

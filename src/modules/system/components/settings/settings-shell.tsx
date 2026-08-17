"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useAppRouter as useRouter } from "@/hooks/use-app-router";
import { PageHeader } from "@/components/Velora/page-header";
import { EmptyStateBlock } from "@/components/Velora/state-blocks";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectLabelById } from "@/lib/select-label";
import type { FeatureFlag } from "@/lib/constants";
import type {
  AppUser,
  AuditLog,
  CostCenter,
  ExpenseCategory,
  ExpenseSettings,
  Organization,
  Permission,
  PermissionKey,
  SessionSettings,
  Store,
  Warehouse,
} from "@/lib/types";
import type { BusinessActivitySettings, UserRole } from "@/lib/constants";
import { BusinessSettingsTab } from "@/modules/system/components/settings/business-settings-tab";
import { ActivitySettingsTab } from "@/modules/system/components/settings/activity-settings-tab";
import { BranchSettingsTab } from "@/modules/system/components/settings/branch-settings-tab";
import { PosSessionSettingsTab } from "@/modules/system/components/settings/pos-session-settings-tab";
import { ExpenseSettingsTab } from "@/modules/system/components/settings/expense-settings-tab";
import { UsersSettingsTab } from "@/modules/system/components/settings/users-settings-tab";
import { SystemFeaturesTab } from "@/modules/system/components/settings/system-features-tab";
import { AuditSettingsTab } from "@/modules/system/components/settings/audit-settings-tab";
import { PrintEngineStudio } from "@/modules/print-engine/components/print-engine-studio";
import type { ReportBranding } from "@/modules/reports/core/report-context";
import type { PrintEngineSettings } from "@/modules/print-engine/lib/print-engine-settings";
import {
  type SettingsGroup,
  type SettingsTabId,
} from "@/modules/system/components/settings/settings-tabs";
import type { ReportScheduleSettings } from "@/modules/reports/lib/report-schedule";

export interface SettingsShellProps {
  activeTab: SettingsTabId;
  visibleTabs: {
    id: SettingsTabId;
    label: string;
    group: SettingsGroup;
    searchTerms: string[];
  }[];
  canManageSettings: boolean;
  canManageSessions: boolean;
  canManageExpenseSettings: boolean;
  canManageCostCenters: boolean;
  receiptHeader: string;
  receiptFooter: string;
  settingsBundle: {
    org: {
      organization: Organization;
      taxRate: number;
      taxInclusive: boolean;
    };
    businessActivity: BusinessActivitySettings;
    featureFlags: Record<FeatureFlag, boolean>;
    expenseSettings: ExpenseSettings;
    sessionSettings: SessionSettings;
    costCenters: CostCenter[];
    stores: Store[];
    warehouses: Warehouse[];
    devices: {
      id: string;
      store_id: string;
      name: string;
      is_active: boolean;
      last_seen_at: string | null;
    }[];
    menuThemeAccess?: {
      rows: import("@/modules/online-menu/lib/menu-theme-commerce").MenuThemeAccessRow[];
    };
    menuViewStatsByStore?: Record<
      string,
      import("@/modules/online-menu/services/online-menu-views.service").OnlineMenuViewStats
    >;
  } | null;
  sessionSettings: SessionSettings | null;
  featureFlags: Record<FeatureFlag, boolean> | null;
  usersBundle: {
    users: AppUser[];
    stores: Store[];
    devices: { id: string; store_id: string; name: string; is_active: boolean; last_seen_at: string | null }[];
    userDeviceIds: Record<string, string[]>;
    actorRole: UserRole;
    permissionsData: {
      permissions: Permission[];
      matrix: Record<UserRole, PermissionKey[]>;
      userGrants: Record<string, { permission_key: string; granted: boolean }[]>;
    } | null;
  } | null;
  costCentersBundle: {
    centers: CostCenter[];
    categories: ExpenseCategory[];
    expenseAccounts: { id: string; code: string; name: string }[];
    activeStoreId: string | null;
  } | null;
  auditBundle: {
    logs: AuditLog[];
    users: AppUser[];
    stores: Store[];
    page: number;
    pageSize: number;
    hasMore: boolean;
    initialFilters: {
      storeId?: string;
      userId?: string;
      action?: string;
      from?: string;
      to?: string;
      page?: string;
    };
  } | null;
  reportSchedule?: ReportScheduleSettings | null;
  printEngineBundle?: {
    settings: PrintEngineSettings;
    branding: ReportBranding;
    generatedBy: string;
  } | null;
  canUploadLogo?: boolean;
}

export function SettingsShell({
  activeTab,
  visibleTabs,
  canManageSettings,
  canManageSessions,
  canManageExpenseSettings,
  canManageCostCenters,
  receiptHeader,
  receiptFooter,
  settingsBundle,
  sessionSettings,
  featureFlags,
  usersBundle,
  costCentersBundle,
  auditBundle,
  reportSchedule = null,
  printEngineBundle = null,
  canUploadLogo = false,
}: SettingsShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [settingsQuery, setSettingsQuery] = useState("");

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      if (tab !== "audit") {
        params.delete("storeId");
        params.delete("userId");
        params.delete("action");
        params.delete("from");
        params.delete("to");
        params.delete("page");
      }
      startTransition(() => {
        router.push(`/settings?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const bundle = settingsBundle;
  const session = bundle?.sessionSettings ?? sessionSettings;
  const flags = bundle?.featureFlags ?? featureFlags;
  const filteredTabs = useMemo(() => {
    const query = settingsQuery.trim().toLowerCase();
    if (!query) return visibleTabs;
    return visibleTabs.filter((tab) => {
      const haystack = `${tab.label} ${tab.group} ${tab.searchTerms.join(" ")}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [settingsQuery, visibleTabs]);

  return (
    <>
      <PageHeader
        breadcrumb={<span>الإدارة · الإعدادات</span>}
        title="الإعدادات"
      />
      <Tabs value={activeTab} onValueChange={setTab} className="min-w-0 flex-col gap-3">
        <div className="min-w-0 space-y-3 rounded-[var(--mds-radius-lg)] border border-border bg-card p-3 shadow-[var(--mds-elevation-1)] sm:p-4">
          <Input
            aria-label="بحث في الإعدادات"
            placeholder="ابحث في الإعدادات..."
            className="h-10"
            value={settingsQuery}
            onChange={(event) => setSettingsQuery(event.target.value)}
          />
          {filteredTabs.length === 0 ? (
            <EmptyStateBlock title="لا توجد نتائج" description="جرّب كلمة بحث أخرى." />
          ) : (
            <>
              <div className="md:hidden">
                <Select
                  value={activeTab}
                  onValueChange={(value) => {
                    if (value) setTab(value);
                  }}
                >
                  <SelectTrigger className="h-11 w-full" aria-label="قسم الإعدادات">
                    <SelectValue>
                      {() =>
                        selectLabelById(filteredTabs, activeTab, (tab) => tab.label) ||
                        selectLabelById(visibleTabs, activeTab, (tab) => tab.label) ||
                        "اختر قسمًا"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredTabs.map((tab) => (
                      <SelectItem key={tab.id} value={tab.id} label={tab.label}>
                        {tab.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden min-w-0 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] md:block [&::-webkit-scrollbar]:hidden">
                <TabsList className="flex h-auto w-max min-w-full flex-nowrap justify-start gap-1 rounded-[var(--mds-radius-md)] bg-muted p-1">
                  {filteredTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      title={tab.label}
                      className="h-9 shrink-0 rounded-[var(--mds-radius-md)] px-3 text-sm font-medium whitespace-nowrap data-active:bg-[var(--mds-color-action-primary)] data-active:text-[var(--mds-color-text-inverse)] data-active:shadow-[var(--mds-elevation-1)]"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </>
          )}
        </div>

        {canManageSettings && bundle ? (
          <>
            <TabsContent value="business" className="min-w-0 data-hidden:hidden">
              <BusinessSettingsTab org={bundle.org} />
            </TabsContent>
            <TabsContent value="activity" className="min-w-0 data-hidden:hidden">
              <ActivitySettingsTab businessActivity={bundle.businessActivity} />
            </TabsContent>
            <TabsContent value="branches" className="min-w-0 data-hidden:hidden">
              <BranchSettingsTab
                stores={bundle.stores}
                warehouses={bundle.warehouses}
                activityType={bundle.businessActivity.activity_type}
                menuThemeRows={bundle.menuThemeAccess?.rows ?? []}
                menuViewStatsByStore={bundle.menuViewStatsByStore}
              />
            </TabsContent>
            <TabsContent value="features" className="min-w-0 data-hidden:hidden">
              <SystemFeaturesTab
                featureFlags={bundle.featureFlags}
                activityType={bundle.businessActivity.activity_type}
                reportSchedule={reportSchedule}
                canManageSchedule={canManageSettings}
              />
            </TabsContent>
          </>
        ) : null}

        {(canManageSettings || canManageSessions) && session && flags ? (
          <TabsContent value="pos" className="min-w-0 data-hidden:hidden">
            <PosSessionSettingsTab
              canManageSettings={canManageSettings}
              canManageSessions={canManageSessions}
              org={bundle?.org}
              receiptHeader={receiptHeader}
              receiptFooter={receiptFooter}
              featureFlags={flags}
              sessionSettings={session}
            />
          </TabsContent>
        ) : null}

        {(canManageExpenseSettings || canManageCostCenters) && (
          <TabsContent value="expenses" className="min-w-0 data-hidden:hidden">
            <ExpenseSettingsTab
              canManageExpenseSettings={canManageExpenseSettings}
              canManageCostCenters={canManageCostCenters}
              expenseSettings={bundle?.expenseSettings}
              costCenters={bundle?.costCenters}
              costCentersPage={costCentersBundle}
            />
          </TabsContent>
        )}

        {usersBundle ? (
          <TabsContent value="users" className="min-w-0 overflow-hidden data-hidden:hidden">
            <UsersSettingsTab {...usersBundle} />
          </TabsContent>
        ) : null}

        {canManageSettings ? (
          <TabsContent value="print" className="min-w-0 data-hidden:hidden">
            {printEngineBundle ? (
              <PrintEngineStudio
                initialSettings={printEngineBundle.settings}
                branding={printEngineBundle.branding}
                generatedBy={printEngineBundle.generatedBy}
                canUploadLogo={canUploadLogo}
              />
            ) : (
              <EmptyStateBlock
                title="محرك الطباعة"
                description="مقدرناش نحمّل القالب. حدّث الصفحة وحاول تاني."
              />
            )}
          </TabsContent>
        ) : null}

        {auditBundle ? (
          <TabsContent value="audit" className="min-w-0 overflow-hidden data-hidden:hidden">
            <AuditSettingsTab {...auditBundle} />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}

"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/SweetFlow/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
import {
  type SettingsGroup,
  type SettingsTabId,
} from "@/modules/system/components/settings/settings-tabs";

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
        description="بيانات المتجر، نوع النشاط، الكاشير، المصروفات، المستخدمون، وإعدادات النظام"
      />
      <Tabs value={activeTab} onValueChange={setTab} className="min-w-0 flex-col space-y-6">
        <div className="min-w-0 space-y-3 rounded-[var(--mds-radius-lg)] border border-border bg-card p-3 shadow-[var(--mds-elevation-1)] sm:p-4">
          <Input
            aria-label="بحث في الإعدادات"
            placeholder="ابحث في الإعدادات..."
            className="h-10"
            value={settingsQuery}
            onChange={(event) => setSettingsQuery(event.target.value)}
          />
          <div className="-mx-3 min-w-0 overflow-x-auto px-3 pb-1 [scrollbar-gutter:stable] sm:-mx-4 sm:px-4">
            {filteredTabs.length > 0 ? (
              <TabsList className="inline-flex h-auto w-max min-w-max flex-nowrap justify-start gap-1 rounded-[var(--mds-radius-md)] bg-muted px-2 py-2">
                {filteredTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="h-9 flex-none rounded-[var(--mds-radius-md)] px-3 text-sm font-medium data-active:bg-[var(--mds-color-action-primary)] data-active:text-[var(--mds-color-text-inverse)] data-active:shadow-[var(--mds-elevation-1)]"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            ) : (
              <p className="text-sm text-muted-foreground">
                لا توجد إعدادات مطابقة للبحث.
              </p>
            )}
          </div>
        </div>

        {canManageSettings && bundle ? (
          <>
            <TabsContent value="business" className="min-w-0 rounded-[var(--mds-radius-lg)] bg-card shadow-[var(--mds-elevation-1)]">
              <BusinessSettingsTab org={bundle.org} />
            </TabsContent>
            <TabsContent value="activity" className="min-w-0 rounded-[var(--mds-radius-lg)] bg-card shadow-[var(--mds-elevation-1)]">
              <ActivitySettingsTab businessActivity={bundle.businessActivity} />
            </TabsContent>
            <TabsContent value="branches" className="min-w-0 rounded-[var(--mds-radius-lg)] bg-card shadow-[var(--mds-elevation-1)]">
              <BranchSettingsTab
                stores={bundle.stores}
                warehouses={bundle.warehouses}
                devices={bundle.devices}
              />
            </TabsContent>
            <TabsContent value="features" className="min-w-0 rounded-[var(--mds-radius-lg)] bg-card shadow-[var(--mds-elevation-1)]">
              <SystemFeaturesTab featureFlags={bundle.featureFlags} />
            </TabsContent>
          </>
        ) : null}

        {(canManageSettings || canManageSessions) && session && flags ? (
          <TabsContent value="pos" className="min-w-0 rounded-[var(--mds-radius-lg)] bg-card shadow-[var(--mds-elevation-1)]">
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
          <TabsContent value="expenses" className="min-w-0 rounded-[var(--mds-radius-lg)] bg-card shadow-[var(--mds-elevation-1)]">
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
          <TabsContent value="users" className="min-w-0 rounded-[var(--mds-radius-lg)] bg-card shadow-[var(--mds-elevation-1)] overflow-hidden">
            <UsersSettingsTab {...usersBundle} />
          </TabsContent>
        ) : null}

        {auditBundle ? (
          <TabsContent value="audit" className="min-w-0 rounded-[var(--mds-radius-lg)] bg-card shadow-[var(--mds-elevation-1)] overflow-hidden">
            <AuditSettingsTab {...auditBundle} />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}

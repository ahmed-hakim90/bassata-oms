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
import type { UserRole } from "@/lib/constants";
import { BusinessSettingsTab } from "@/modules/system/components/settings/business-settings-tab";
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
  receiptFooter: string;
  settingsBundle: {
    org: {
      organization: Organization;
      taxRate: number;
      taxInclusive: boolean;
    };
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
        title="Settings"
        description="Store profile, POS, expenses, users, and system configuration"
      />
      <Tabs value={activeTab} onValueChange={setTab} className="min-w-0 flex-col space-y-6">
        <div className="min-w-0 space-y-3 rounded-xl border border-border/60 p-3 sm:p-4">
          <Input
            aria-label="Search settings"
            placeholder="Search settings..."
            value={settingsQuery}
            onChange={(event) => setSettingsQuery(event.target.value)}
          />
          <div className="-mx-3 min-w-0 overflow-x-auto px-3 pb-2 [scrollbar-gutter:stable] sm:-mx-4 sm:px-4">
            {filteredTabs.length > 0 ? (
              <TabsList className="flex h-auto w-max min-w-max flex-nowrap justify-start gap-1 rounded-xl bg-muted/60 px-2 py-3">
                {filteredTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="h-9 flex-none rounded-lg px-3 text-sm font-medium data-active:bg-background data-active:text-foreground data-active:shadow-sm"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            ) : (
              <p className="text-sm text-muted-foreground">
                No settings match your search.
              </p>
            )}
          </div>
        </div>

        {canManageSettings && bundle ? (
          <>
            <TabsContent value="business" className="min-w-0">
              <BusinessSettingsTab org={bundle.org} />
            </TabsContent>
            <TabsContent value="branches" className="min-w-0">
              <BranchSettingsTab
                stores={bundle.stores}
                warehouses={bundle.warehouses}
                devices={bundle.devices}
              />
            </TabsContent>
            <TabsContent value="features" className="min-w-0">
              <SystemFeaturesTab featureFlags={bundle.featureFlags} />
            </TabsContent>
          </>
        ) : null}

        {(canManageSettings || canManageSessions) && session && flags ? (
          <TabsContent value="pos" className="min-w-0">
            <PosSessionSettingsTab
              canManageSettings={canManageSettings}
              canManageSessions={canManageSessions}
              org={bundle?.org}
              receiptFooter={receiptFooter}
              featureFlags={flags}
              sessionSettings={session}
            />
          </TabsContent>
        ) : null}

        {(canManageExpenseSettings || canManageCostCenters) && (
          <TabsContent value="expenses" className="min-w-0">
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
          <TabsContent value="users" className="min-w-0">
            <UsersSettingsTab {...usersBundle} />
          </TabsContent>
        ) : null}

        {auditBundle ? (
          <TabsContent value="audit" className="min-w-0">
            <AuditSettingsTab {...auditBundle} />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}

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
  OnlineMenuSettings,
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
import { SouqnaSettingsTab } from "@/modules/system/components/settings/souqna-settings-tab";
import { BusinessActivitySettingsTab } from "@/modules/system/components/settings/business-activity-settings-tab";
import {
  type SettingsGroup,
  type SettingsTabId,
} from "@/modules/system/components/settings/settings-tabs";
import type { SouqnaIntegrationLog, SouqnaPublicApiConfig } from "@/lib/types";

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
    onlineMenuSettings: OnlineMenuSettings;
    businessActivitySettings: import("@/lib/constants").BusinessActivitySettings;
    productTemplateSettings: import("@/lib/constants").ProductTemplateSettings;
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
  souqnaBundle: {
    settings: {
      enable_souqna_channel: boolean;
      api_base_url: string;
      api_key_prefix: string;
      allowed_store_id: string | null;
      allow_order_import: boolean;
      reserve_stock_on_online_order: boolean;
      publish_products_to_souqna: boolean;
      enable_souqna_webhook: boolean;
      souqna_webhook_url: string;
      has_webhook_secret: boolean;
      has_api_key: boolean;
      api: SouqnaPublicApiConfig;
    };
    stats: {
      published_products_count: number;
      imported_orders_count: number;
      last_products_sync_at: string | null;
      last_order_import_at: string | null;
      last_error_at: string | null;
      last_error_message: string | null;
    };
    logs: SouqnaIntegrationLog[];
    logsPage: number;
    logsHasMore: boolean;
    migrationRequired?: boolean;
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
  souqnaBundle,
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
        description="Organization, branches, POS, expenses, users, and system configuration"
      />
      <Tabs value={activeTab} onValueChange={setTab} className="flex-col space-y-6">
        <div className="space-y-3 rounded-xl border border-border/60 p-4">
          <Input
            aria-label="Search settings"
            placeholder="Search settings..."
            value={settingsQuery}
            onChange={(event) => setSettingsQuery(event.target.value)}
          />
          <div className="space-y-3 px-2">
            {filteredTabs.length > 0 ? (
              <TabsList className="h-auto w-full flex-nowrap justify-start gap-1 py-4 px-2 rounded-xl bg-muted/60 p-1">
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
            <TabsContent value="business">
              <BusinessSettingsTab
                org={bundle.org}
                onlineMenuSettings={bundle.onlineMenuSettings}
              />
            </TabsContent>
            <TabsContent value="business-activity">
              <BusinessActivitySettingsTab
                initialSettings={bundle.businessActivitySettings}
                initialTemplates={bundle.productTemplateSettings}
              />
            </TabsContent>
            <TabsContent value="branches">
              <BranchSettingsTab
                stores={bundle.stores}
                warehouses={bundle.warehouses}
                devices={bundle.devices}
              />
            </TabsContent>
            <TabsContent value="features">
              <SystemFeaturesTab featureFlags={bundle.featureFlags} />
            </TabsContent>
          </>
        ) : null}

        {(canManageSettings || canManageSessions) && session && flags ? (
          <TabsContent value="pos">
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
          <TabsContent value="expenses">
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
          <TabsContent value="users">
            <UsersSettingsTab {...usersBundle} />
          </TabsContent>
        ) : null}

        {auditBundle ? (
          <TabsContent value="audit">
            <AuditSettingsTab {...auditBundle} />
          </TabsContent>
        ) : null}

        {souqnaBundle && bundle ? (
          <TabsContent value="souqna">
            <SouqnaSettingsTab
              souqnaSettings={souqnaBundle.settings}
              souqnaStats={souqnaBundle.stats}
              stores={bundle.stores}
              initialLogs={souqnaBundle.logs}
              initialLogsPage={souqnaBundle.logsPage}
              initialLogsHasMore={souqnaBundle.logsHasMore}
              migrationRequired={souqnaBundle.migrationRequired}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  );
}

import type { PermissionKey } from "@/lib/constants";

export const SETTINGS_TAB_IDS = [
  "business",
  "business-activity",
  "branches",
  "pos",
  "expenses",
  "users",
  "features",
  "souqna",
  "audit",
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

export const SETTINGS_GROUPS = [
  "Organization",
  "POS",
  "Inventory",
  "Customers",
  "Security",
  "Advanced",
] as const;
export type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

export const SETTINGS_TABS: {
  id: SettingsTabId;
  label: string;
  permissions: PermissionKey[];
  group: SettingsGroup;
  searchTerms: string[];
}[] = [
  {
    id: "business",
    label: "Company",
    permissions: ["settings_manage"],
    group: "Organization",
    searchTerms: ["organization", "company", "branding"],
  },
  {
    id: "business-activity",
    label: "Branding & Activity",
    permissions: ["manage_business_activity", "settings_manage"],
    group: "Organization",
    searchTerms: ["business activity", "templates", "branding"],
  },
  {
    id: "branches",
    label: "Branches & Devices",
    permissions: ["settings_manage"],
    group: "Organization",
    searchTerms: ["branches", "stores", "devices", "terminals"],
  },
  {
    id: "pos",
    label: "POS, Receipts & Payments",
    permissions: ["settings_manage", "session_settings_manage"],
    group: "POS",
    searchTerms: ["pos", "sessions", "receipts", "payments"],
  },
  {
    id: "expenses",
    label: "Units, Transfers & Expenses",
    permissions: ["settings_manage", "cost_center_manage"],
    group: "Inventory",
    searchTerms: ["units", "transfers", "expenses", "cost centers"],
  },
  {
    id: "users",
    label: "Users, Roles & Permissions",
    permissions: ["user_manage"],
    group: "Security",
    searchTerms: ["users", "roles", "permissions", "security"],
  },
  {
    id: "features",
    label: "Feature Flags",
    permissions: ["settings_manage"],
    group: "Advanced",
    searchTerms: ["feature flags", "flags", "toggles"],
  },
  {
    id: "souqna",
    label: "Integrations",
    permissions: ["settings_manage"],
    group: "Advanced",
    searchTerms: ["integration", "souqna", "api", "webhook"],
  },
  {
    id: "audit",
    label: "Audit",
    permissions: ["audit_view"],
    group: "Advanced",
    searchTerms: ["audit", "logs"],
  },
];

export function tabVisible(
  tab: (typeof SETTINGS_TABS)[number],
  permissions: Set<PermissionKey>,
  isOwner: boolean
): boolean {
  if (isOwner) return true;
  return tab.permissions.some((p) => permissions.has(p));
}

export function getVisibleSettingsTabs(
  permissions: Set<PermissionKey>,
  isOwner: boolean
): (typeof SETTINGS_TABS)[number][] {
  return SETTINGS_TABS.filter((tab) => tabVisible(tab, permissions, isOwner));
}

export function groupSettingsTabs(
  tabs: Array<Pick<(typeof SETTINGS_TABS)[number], "id" | "label" | "group" | "searchTerms">>
): Array<{
  group: SettingsGroup;
  tabs: Array<Pick<(typeof SETTINGS_TABS)[number], "id" | "label" | "group" | "searchTerms">>;
}> {
  return SETTINGS_GROUPS.map((group) => ({
    group,
    tabs: tabs.filter((tab) => tab.group === group),
  })).filter((entry) => entry.tabs.length > 0);
}

export function resolveSettingsTab(
  requested: string | undefined,
  permissions: Set<PermissionKey>,
  isOwner: boolean
): SettingsTabId {
  const visible = getVisibleSettingsTabs(permissions, isOwner);
  const fallback = visible[0]?.id ?? "business";
  if (!requested) return fallback;
  const match = visible.find((t) => t.id === requested);
  return match?.id ?? fallback;
}

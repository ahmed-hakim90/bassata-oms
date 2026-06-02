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

export const SETTINGS_TABS: {
  id: SettingsTabId;
  label: string;
  permissions: PermissionKey[];
}[] = [
  { id: "business", label: "Business", permissions: ["settings_manage"] },
  {
    id: "business-activity",
    label: "Business Activity",
    permissions: ["manage_business_activity", "settings_manage"],
  },
  { id: "branches", label: "Stores", permissions: ["settings_manage"] },
  {
    id: "pos",
    label: "POS & Sessions",
    permissions: ["settings_manage", "session_settings_manage"],
  },
  {
    id: "expenses",
    label: "Expenses",
    permissions: ["settings_manage", "cost_center_manage"],
  },
  { id: "users", label: "Users & Roles", permissions: ["user_manage"] },
  { id: "features", label: "System Features", permissions: ["settings_manage"] },
  { id: "souqna", label: "Souqna", permissions: ["settings_manage"] },
  { id: "audit", label: "Audit", permissions: ["audit_view"] },
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

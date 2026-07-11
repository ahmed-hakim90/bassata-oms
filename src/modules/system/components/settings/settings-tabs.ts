import type { PermissionKey } from "@/lib/constants";

export const SETTINGS_TAB_IDS = [
  "business",
  "branches",
  "pos",
  "expenses",
  "users",
  "features",
  "audit",
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

export const SETTINGS_GROUPS = [
  "المتجر",
  "الكاشير",
  "المخزون",
  "الأمان",
  "متقدم",
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
    label: "المتجر",
    permissions: ["settings_manage"],
    group: "المتجر",
    searchTerms: ["store", "company", "branding", "logo", "currency", "متجر", "شركة", "شعار", "عملة"],
  },
  {
    id: "branches",
    label: "الفروع",
    permissions: ["settings_manage"],
    group: "المتجر",
    searchTerms: ["branches", "stores", "devices", "terminals", "فروع", "أجهزة", "كاشير"],
  },
  {
    id: "pos",
    label: "الكاشير",
    permissions: ["settings_manage", "session_settings_manage"],
    group: "الكاشير",
    searchTerms: ["pos", "sessions", "receipts", "payments", "كاشير", "جلسات", "إيصالات", "دفع"],
  },
  {
    id: "expenses",
    label: "المصروفات",
    permissions: ["settings_manage", "cost_center_manage"],
    group: "المخزون",
    searchTerms: ["units", "transfers", "expenses", "categories", "وحدات", "تحويلات", "مصروفات", "تصنيفات"],
  },
  {
    id: "users",
    label: "المستخدمون",
    permissions: ["user_manage"],
    group: "الأمان",
    searchTerms: ["users", "roles", "permissions", "security", "مستخدمين", "أدوار", "صلاحيات", "أمان"],
  },
  {
    id: "features",
    label: "خصائص النظام",
    permissions: ["settings_manage"],
    group: "متقدم",
    searchTerms: ["feature flags", "flags", "toggles", "خصائص", "مفاتيح", "تفعيل"],
  },
  {
    id: "audit",
    label: "سجل المراجعة",
    permissions: ["audit_view"],
    group: "متقدم",
    searchTerms: ["audit", "logs", "مراجعة", "سجلات"],
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

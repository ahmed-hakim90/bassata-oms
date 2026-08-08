"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import type { FeatureFlag, UserRole } from "@/lib/constants";
import {
  createCompanyInvite,
  revokeCompanyInvite,
} from "@/modules/platform/services/platform-invite.service";
import {
  setOrganizationStatus,
  type OrganizationSuspendReason,
} from "@/modules/platform/services/platform-org.service";
import {
  exportPlatformDevicesReport,
  exportPlatformOrganizationsReport,
  exportPlatformUsageReport,
  exportPlatformUsersReport,
} from "@/modules/platform/services/platform-report.service";
import {
  listPlatformAdmins,
  setPlatformAdminActive,
  upsertPlatformAdmin,
} from "@/modules/platform/services/platform-admin.service";
import {
  createPlatformTenantUser,
  listPlatformStoresForOrg,
  listPlatformTenantUsers,
  resetPlatformTenantUserPassword,
  setPlatformTenantUserActive,
  setPlatformTenantUserRole,
  signOutPlatformTenantUser,
  updatePlatformTenantUserProfile,
  type PlatformStoreOption,
  type PlatformTenantUser,
} from "@/modules/platform/services/platform-users.service";
import {
  forceClosePlatformSession,
  setPlatformDeviceActive,
} from "@/modules/platform/services/platform-ops.service";
import {
  updatePlatformOrgFeatureFlags,
  updatePlatformOrgRemoteSettings,
  type PlatformOrgConfig,
} from "@/modules/platform/services/platform-org-config.service";
import { createTenantImpersonationLink } from "@/modules/platform/services/platform-impersonate.service";
import {
  setPlatformPlan,
  type PlatformPlan,
} from "@/modules/platform/services/platform-plan.service";
import type { OrgCustomDomain } from "@/modules/platform/services/platform-custom-domain.service";
import {
  setPlatformWebhookConfig,
  type PlatformWebhookConfig,
} from "@/modules/platform/services/platform-webhooks.service";
import {
  sendPlatformBroadcast,
  type BroadcastAudience,
  type BroadcastResult,
} from "@/modules/platform/services/platform-marketing.service";
import type { MenuThemeSlug } from "@/modules/online-menu/lib/menu-themes";
import type {
  MenuThemeCatalog,
  MenuThemeCatalogEntry,
  MenuThemeEntitlements,
} from "@/modules/online-menu/lib/menu-theme-commerce";

export type PlatformActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidatePlatformOrg(orgId?: string) {
  revalidatePath("/platform");
  revalidatePath("/platform/users");
  revalidatePath("/platform/devices");
  revalidatePath("/platform/sessions");
  revalidatePath("/platform/ops");
  revalidatePath("/platform/usage");
  revalidatePath("/platform/menu-themes");
  revalidatePath("/platform/invites");
  revalidatePath("/platform/audit");
  if (orgId) revalidatePath(`/platform/orgs/${orgId}`);
}

export async function suspendOrganizationAction(
  orgId: string,
  options?: { reason?: OrganizationSuspendReason; note?: string }
): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    const reason = options?.reason ?? "ops";
    if (!["non_payment", "ops", "other"].includes(reason)) {
      return { ok: false, error: "سبب التعليق غير صالح" };
    }
    await setOrganizationStatus(admin, orgId, "suspended", {
      reason,
      note: options?.note,
    });
    revalidatePlatformOrg(orgId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تعليق الشركة",
    };
  }
}

export async function reactivateOrganizationAction(
  orgId: string
): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await setOrganizationStatus(admin, orgId, "active");
    revalidatePlatformOrg(orgId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إعادة تفعيل الشركة",
    };
  }
}

export async function createCompanyInviteAction(input: {
  orgName: string;
  ownerName?: string;
  ownerEmail: string;
  expiresInDays?: number;
}): Promise<PlatformActionResult<{ inviteId: string; token: string; expiresAt: string }>> {
  try {
    const admin = await requirePlatformAdmin();
    const { invite, token } = await createCompanyInvite(admin, input);
    revalidatePath("/platform");
    revalidatePath("/platform/invites");
    return {
      ok: true,
      data: {
        inviteId: invite.id,
        token,
        expiresAt: invite.expires_at,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إنشاء الدعوة",
    };
  }
}

export async function revokeCompanyInviteAction(
  inviteId: string
): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await revokeCompanyInvite(admin, inviteId);
    revalidatePath("/platform");
    revalidatePath("/platform/invites");
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إلغاء الدعوة",
    };
  }
}

export async function exportPlatformOrganizationsExcelAction(): Promise<
  PlatformActionResult<{ base64: string; fileName: string }>
> {
  try {
    await requirePlatformAdmin();
    const report = await exportPlatformOrganizationsReport();
    return { ok: true, data: report };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تصدير التقرير",
    };
  }
}

export async function exportPlatformUsageExcelAction(): Promise<
  PlatformActionResult<{ base64: string; fileName: string }>
> {
  try {
    await requirePlatformAdmin();
    const report = await exportPlatformUsageReport();
    return { ok: true, data: report };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تصدير الاستهلاك",
    };
  }
}

function revalidateUsers() {
  revalidatePath("/platform");
  revalidatePath("/platform/users");
}

export async function listPlatformTenantUsersAction(input?: {
  search?: string;
  orgId?: string;
}): Promise<PlatformActionResult<PlatformTenantUser[]>> {
  try {
    await requirePlatformAdmin();
    const users = await listPlatformTenantUsers(input);
    return { ok: true, data: users };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل جلب المستخدمين",
    };
  }
}

export async function listPlatformStoresForOrgAction(
  orgId: string
): Promise<PlatformActionResult<PlatformStoreOption[]>> {
  try {
    await requirePlatformAdmin();
    const stores = await listPlatformStoresForOrg(orgId);
    return { ok: true, data: stores };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل جلب الفروع",
    };
  }
}

export async function setPlatformTenantUserActiveAction(input: {
  userId: string;
  isActive: boolean;
}): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await setPlatformTenantUserActive(admin, input.userId, input.isActive);
    revalidateUsers();
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث حالة المستخدم",
    };
  }
}

export async function setPlatformTenantUserRoleAction(input: {
  userId: string;
  role: UserRole;
}): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await setPlatformTenantUserRole(admin, input.userId, input.role);
    revalidateUsers();
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تغيير الدور",
    };
  }
}

export async function resetPlatformTenantUserPasswordAction(input: {
  userId: string;
  password: string;
}): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await resetPlatformTenantUserPassword(admin, input.userId, input.password);
    revalidateUsers();
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إعادة تعيين كلمة المرور",
    };
  }
}

export async function signOutPlatformTenantUserAction(
  userId: string
): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await signOutPlatformTenantUser(admin, userId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إنهاء الجلسات",
    };
  }
}

export async function updatePlatformTenantUserProfileAction(input: {
  userId: string;
  name?: string;
  email?: string;
}): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await updatePlatformTenantUserProfile(admin, input.userId, input);
    revalidateUsers();
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث المستخدم",
    };
  }
}

export async function createPlatformTenantUserAction(input: {
  orgId: string;
  name: string;
  email: string;
  role: UserRole;
  storeIds: string[];
  password: string;
}): Promise<PlatformActionResult<{ userId: string }>> {
  try {
    const admin = await requirePlatformAdmin();
    const user = await createPlatformTenantUser(admin, input);
    revalidateUsers();
    return { ok: true, data: { userId: user.id } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إنشاء المستخدم",
    };
  }
}

export async function listPlatformAdminsAction(): Promise<
  PlatformActionResult<Awaited<ReturnType<typeof listPlatformAdmins>>>
> {
  try {
    await requirePlatformAdmin();
    const admins = await listPlatformAdmins();
    return { ok: true, data: admins };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل جلب مشرفي المنصة",
    };
  }
}

export async function upsertPlatformAdminAction(input: {
  email: string;
  name?: string;
}): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await upsertPlatformAdmin(admin, input);
    revalidateUsers();
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إضافة مشرف المنصة",
    };
  }
}

export async function setPlatformAdminActiveAction(input: {
  platformAdminId: string;
  isActive: boolean;
}): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await setPlatformAdminActive(admin, input.platformAdminId, input.isActive);
    revalidateUsers();
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث مشرف المنصة",
    };
  }
}

export async function setPlatformDeviceActiveAction(input: {
  deviceId: string;
  isActive: boolean;
}): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await setPlatformDeviceActive(admin, input.deviceId, input.isActive);
    revalidatePlatformOrg();
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث الجهاز",
    };
  }
}

export async function forceClosePlatformSessionAction(input: {
  sessionId: string;
  closeReason: string;
  actualCash?: number;
}): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await forceClosePlatformSession(admin, input);
    revalidatePlatformOrg();
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إغلاق الجلسة",
    };
  }
}

export async function updatePlatformOrgFeatureFlagsAction(input: {
  orgId: string;
  flags: Partial<Record<FeatureFlag, boolean>>;
}): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await updatePlatformOrgFeatureFlags(admin, input.orgId, input.flags);
    revalidatePlatformOrg(input.orgId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث الميزات",
    };
  }
}

export async function updatePlatformOrgRemoteSettingsAction(input: {
  orgId: string;
  currency?: string;
  timezone?: string;
  country?: string;
  taxRate?: number;
  taxInclusive?: boolean;
  sessionSettings?: Partial<PlatformOrgConfig["sessionSettings"]>;
}): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    const { orgId, ...rest } = input;
    await updatePlatformOrgRemoteSettings(admin, orgId, rest);
    revalidatePlatformOrg(orgId);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث الإعدادات",
    };
  }
}

export async function exportPlatformUsersExcelAction(): Promise<
  PlatformActionResult<{ base64: string; fileName: string }>
> {
  try {
    await requirePlatformAdmin();
    const report = await exportPlatformUsersReport();
    return { ok: true, data: report };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تصدير المستخدمين",
    };
  }
}

export async function exportPlatformDevicesExcelAction(): Promise<
  PlatformActionResult<{ base64: string; fileName: string }>
> {
  try {
    await requirePlatformAdmin();
    const report = await exportPlatformDevicesReport();
    return { ok: true, data: report };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تصدير الأجهزة",
    };
  }
}

export async function createTenantImpersonationLinkAction(
  userId: string
): Promise<PlatformActionResult<{ actionLink: string; email: string }>> {
  try {
    const admin = await requirePlatformAdmin();
    const result = await createTenantImpersonationLink(admin, userId);
    return {
      ok: true,
      data: { actionLink: result.actionLink, email: result.email },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إنشاء لينك الدخول",
    };
  }
}

export async function setPlatformPlanAction(input: {
  orgId: string;
  plan: PlatformPlan;
}): Promise<PlatformActionResult<PlatformPlan>> {
  try {
    const admin = await requirePlatformAdmin();
    const plan = await setPlatformPlan(admin, input.orgId, input.plan);
    revalidatePlatformOrg(input.orgId);
    return { ok: true, data: plan };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث الباقة",
    };
  }
}

export async function setOrgCustomDomainAction(input: {
  orgId: string;
  domain: string | null;
}): Promise<PlatformActionResult<OrgCustomDomain>> {
  try {
    const admin = await requirePlatformAdmin();
    const { setOrgCustomDomain } = await import(
      "@/modules/platform/services/platform-custom-domain.service"
    );
    const data = await setOrgCustomDomain(admin, input.orgId, input.domain);
    revalidatePlatformOrg(input.orgId);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل حفظ الدومين",
    };
  }
}

export async function verifyOrgCustomDomainAction(
  orgId: string
): Promise<PlatformActionResult<OrgCustomDomain>> {
  try {
    const admin = await requirePlatformAdmin();
    const { verifyOrgCustomDomain } = await import(
      "@/modules/platform/services/platform-custom-domain.service"
    );
    const data = await verifyOrgCustomDomain(admin, orgId);
    revalidatePlatformOrg(orgId);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل التحقق من الدومين",
    };
  }
}

export async function exportOrganizationLifecycleAction(
  orgId: string
): Promise<PlatformActionResult<Record<string, unknown>>> {
  try {
    const admin = await requirePlatformAdmin();
    const { exportOrganizationLifecycleSummary } = await import(
      "@/modules/platform/services/platform-org-lifecycle.service"
    );
    const data = await exportOrganizationLifecycleSummary(admin, orgId);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تصدير بيانات الشركة",
    };
  }
}

export async function exportOrganizationFullDataAction(
  orgId: string
): Promise<PlatformActionResult<Record<string, unknown>>> {
  try {
    const admin = await requirePlatformAdmin();
    if (!orgId?.trim()) return { ok: false, error: "معرّف الشركة مطلوب" };
    const { exportOrganizationFullData } = await import(
      "@/modules/platform/services/platform-org-data-export.service"
    );
    const data = await exportOrganizationFullData(admin, orgId);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تصدير بيانات الشركة الكاملة",
    };
  }
}

export async function updateMenuThemeCatalogAction(
  updates: Partial<Record<MenuThemeSlug, Partial<MenuThemeCatalogEntry>>>
): Promise<PlatformActionResult<MenuThemeCatalog>> {
  try {
    const admin = await requirePlatformAdmin();
    const { updateMenuThemeCatalogEntries } = await import(
      "@/modules/platform/services/platform-menu-themes.service"
    );
    const data = await updateMenuThemeCatalogEntries(admin, updates);
    revalidatePath("/platform/menu-themes");
    revalidatePath("/settings");
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث كتالوج الثيمات",
    };
  }
}

export async function setOrgMenuThemeEntitlementsAction(input: {
  orgId: string;
  enabledThemes: string[];
  notes?: string;
}): Promise<PlatformActionResult<MenuThemeEntitlements>> {
  try {
    const admin = await requirePlatformAdmin();
    if (!input.orgId?.trim()) return { ok: false, error: "معرّف الشركة مطلوب" };
    const { setOrgMenuThemeEntitlements } = await import(
      "@/modules/platform/services/platform-menu-themes.service"
    );
    const data = await setOrgMenuThemeEntitlements(admin, input.orgId, {
      enabledThemes: input.enabledThemes as MenuThemeSlug[],
      notes: input.notes ?? "",
    });
    revalidatePlatformOrg(input.orgId);
    revalidatePath("/settings");
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث ثيمات الشركة",
    };
  }
}

export async function setPlatformWebhookConfigAction(input: {
  orgId: string;
  enabled?: boolean;
  url?: string;
  events?: PlatformWebhookConfig["events"];
  rotateSecret?: boolean;
}): Promise<PlatformActionResult<PlatformWebhookConfig>> {
  try {
    const admin = await requirePlatformAdmin();
    const { orgId, ...rest } = input;
    const config = await setPlatformWebhookConfig(admin, orgId, rest);
    revalidatePlatformOrg(orgId);
    return { ok: true, data: config };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل تحديث الـ webhook",
    };
  }
}

export async function sendPlatformBroadcastAction(input: {
  audience: BroadcastAudience;
  orgId?: string;
  subject: string;
  body: string;
}): Promise<PlatformActionResult<BroadcastResult>> {
  try {
    const admin = await requirePlatformAdmin();
    const result = await sendPlatformBroadcast(admin, input);
    revalidatePath("/platform/marketing");
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إرسال الرسالة",
    };
  }
}

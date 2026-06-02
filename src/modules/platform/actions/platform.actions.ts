"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/platform/auth";
import {
  clearPlatformSupportSession,
  setPlatformSupportSession,
} from "@/lib/platform/support-session";
import {
  createCompanyInvite,
  reissueCompanyInvite,
  reassignCompanyOwner,
  revokeCompanyInvite,
  updateCompany,
  writePlatformAuditLog,
  type CompanyStatus,
} from "@/modules/platform/services/platform.service";

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function createCompanyInviteAction(formData: FormData) {
  const platformAdmin = await requirePlatformAdmin();
  const orgName = String(formData.get("orgName") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const days = Number(formData.get("expiresInDays") ?? 14);
  if (orgName.length < 2 || ownerName.length < 2 || !ownerEmail.includes("@")) {
    throw new Error("Company name, owner name, and a valid owner email are required.");
  }
  const { token } = await createCompanyInvite({
    orgName,
    ownerName,
    ownerEmail,
    expiresInDays: Number.isFinite(days) && days > 0 ? days : 14,
    platformAdminId: platformAdmin.id,
  });
  const origin = await siteOrigin();
  revalidatePath("/platform");
  redirect(`/platform?invite=${encodeURIComponent(`${origin}/onboarding?invite=${token}`)}`);
}

export async function revokeCompanyInviteAction(formData: FormData) {
  const platformAdmin = await requirePlatformAdmin();
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) throw new Error("Invite id is required.");
  await revokeCompanyInvite(inviteId, platformAdmin.id);
  revalidatePath("/platform");
}

export async function reissueCompanyInviteAction(formData: FormData) {
  const platformAdmin = await requirePlatformAdmin();
  const inviteId = String(formData.get("inviteId") ?? "");
  if (!inviteId) throw new Error("Invite id is required.");
  const { token } = await reissueCompanyInvite(inviteId, platformAdmin.id);
  const origin = await siteOrigin();
  revalidatePath("/platform");
  redirect(`/platform?invite=${encodeURIComponent(`${origin}/onboarding?invite=${token}`)}`);
}

export async function updateCompanyAction(formData: FormData) {
  const platformAdmin = await requirePlatformAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  const status = String(formData.get("status") ?? "active") as CompanyStatus;
  if (!orgId) throw new Error("Company id is required.");
  if (status !== "active" && status !== "suspended") {
    throw new Error("Invalid company status.");
  }
  await updateCompany(
    orgId,
    {
      name: String(formData.get("name") ?? "").trim(),
      currency: String(formData.get("currency") ?? "").trim(),
      timezone: String(formData.get("timezone") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim(),
      status,
    },
    platformAdmin.id
  );
  revalidatePath("/platform");
  revalidatePath(`/platform/companies/${orgId}`);
}

export async function reassignCompanyOwnerAction(formData: FormData) {
  const platformAdmin = await requirePlatformAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!orgId || ownerName.length < 2 || !ownerEmail.includes("@") || password.length < 8) {
    throw new Error("Company, owner name, owner email, and an 8-character password are required.");
  }
  await reassignCompanyOwner({
    orgId,
    ownerName,
    ownerEmail,
    password,
    platformAdminId: platformAdmin.id,
  });
  revalidatePath("/platform");
  revalidatePath(`/platform/companies/${orgId}`);
}

export async function startSupportViewAction(formData: FormData) {
  const platformAdmin = await requirePlatformAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!orgId || reason.length < 3) {
    throw new Error("Company and support reason are required.");
  }
  await setPlatformSupportSession({
    platformAdminId: platformAdmin.id,
    orgId,
    reason,
    mode: "view",
  });
  await writePlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: "support_view.started",
    entityType: "organization",
    entityId: orgId,
    metadata: { reason, mode: "view" },
  });
  revalidatePath(`/platform/companies/${orgId}`);
  redirect(`/platform/companies/${orgId}`);
}

export async function endSupportViewAction(formData: FormData) {
  const platformAdmin = await requirePlatformAdmin();
  const orgId = String(formData.get("orgId") ?? "");
  await clearPlatformSupportSession();
  if (orgId) {
    await writePlatformAuditLog({
      platformAdminId: platformAdmin.id,
      action: "support_view.ended",
      entityType: "organization",
      entityId: orgId,
    });
    revalidatePath(`/platform/companies/${orgId}`);
  }
}

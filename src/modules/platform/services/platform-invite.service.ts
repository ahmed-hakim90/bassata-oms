import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { writePlatformAuditLog } from "@/modules/platform/services/platform-audit.service";

const DEFAULT_INVITE_TTL_DAYS = 14;

export type PlatformInviteRow = {
  id: string;
  org_name: string;
  owner_name: string;
  owner_email: string;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  accepted_org_id: string | null;
};

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function listCompanyInvites(limit = 50): Promise<PlatformInviteRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_company_invites")
    .select(
      "id, org_name, owner_name, owner_email, status, expires_at, created_at, accepted_at, revoked_at, accepted_org_id"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`platform_company_invites list failed: ${error.message}`);
  return data ?? [];
}

export async function countPendingCompanyInvites(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("platform_company_invites")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(`platform_company_invites count failed: ${error.message}`);
  return count ?? 0;
}

export async function createCompanyInvite(
  platformAdmin: PlatformAdmin,
  input: {
    orgName: string;
    ownerName?: string;
    ownerEmail: string;
    expiresInDays?: number;
  }
): Promise<{ invite: PlatformInviteRow; token: string }> {
  const orgName = input.orgName.trim();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const ownerName = (input.ownerName ?? "").trim();

  if (!orgName) throw new Error("اسم الشركة مطلوب");
  if (!ownerEmail || !ownerEmail.includes("@")) {
    throw new Error("البريد الإلكتروني للمالك غير صالح");
  }

  const ttlDays = input.expiresInDays ?? DEFAULT_INVITE_TTL_DAYS;
  if (ttlDays < 1 || ttlDays > 90) {
    throw new Error("مدة الدعوة لازم تكون بين 1 و 90 يوم");
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_company_invites")
    .insert({
      token_hash: tokenHash,
      org_name: orgName,
      owner_name: ownerName,
      owner_email: ownerEmail,
      status: "pending",
      expires_at: expiresAt,
      created_by: platformAdmin.id,
    })
    .select(
      "id, org_name, owner_name, owner_email, status, expires_at, created_at, accepted_at, revoked_at, accepted_org_id"
    )
    .single();

  if (error) throw new Error(`platform_company_invites insert failed: ${error.message}`);

  await writePlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: "invite.create",
    entityType: "platform_company_invite",
    entityId: data.id,
    metadata: {
      org_name: orgName,
      owner_email: ownerEmail,
      expires_at: expiresAt,
    },
  });

  return { invite: data, token };
}

export type InviteTokenFailureReason =
  | "missing"
  | "invalid"
  | "expired"
  | "used"
  | "revoked"
  | "unavailable";

const INVITE_TOKEN_ERROR_MESSAGES: Record<InviteTokenFailureReason, string> = {
  missing: "رمز الدعوة مطلوب لإنشاء شركة جديدة.",
  invalid: "رمز الدعوة غير صالح.",
  expired: "انتهت صلاحية رمز الدعوة.",
  used: "رمز الدعوة مستخدم بالفعل.",
  revoked: "تم إلغاء رمز الدعوة.",
  unavailable: "مفيش دعوة متاحة للاستخدام دلوقتي. تواصل مع الدعم.",
};

export class InviteTokenError extends Error {
  readonly reason: InviteTokenFailureReason;

  constructor(reason: InviteTokenFailureReason) {
    super(INVITE_TOKEN_ERROR_MESSAGES[reason]);
    this.name = "InviteTokenError";
    this.reason = reason;
  }
}

/** Production always requires an invite. Non-prod is open unless ONBOARDING_REQUIRE_INVITE=true. */
export function isOnboardingInviteRequired(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return process.env.ONBOARDING_REQUIRE_INVITE === "true";
}

/**
 * Look up a pending, non-expired invite by plaintext token (hashed).
 * Does not consume — call {@link consumeCompanyInvite} after org create.
 */
export async function assertConsumableInviteByToken(
  token: string
): Promise<PlatformInviteRow> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new InviteTokenError("missing");
  }

  const tokenHash = hashInviteToken(trimmed);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_company_invites")
    .select(
      "id, org_name, owner_name, owner_email, status, expires_at, created_at, accepted_at, revoked_at, accepted_org_id"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) throw new Error(`platform_company_invites lookup failed: ${error.message}`);
  if (!data) throw new InviteTokenError("invalid");

  if (data.status === "accepted") throw new InviteTokenError("used");
  if (data.status === "revoked") throw new InviteTokenError("revoked");
  if (data.status === "expired") throw new InviteTokenError("expired");

  if (data.status !== "pending") {
    throw new InviteTokenError("unavailable");
  }

  const expiresAt = new Date(data.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    const now = new Date().toISOString();
    await admin
      .from("platform_company_invites")
      .update({ status: "expired", updated_at: now })
      .eq("id", data.id)
      .eq("status", "pending");
    throw new InviteTokenError("expired");
  }

  return data;
}

/** Atomically mark invite accepted; fails if already used/expired/revoked. */
export async function consumeCompanyInvite(
  inviteId: string,
  acceptedOrgId: string
): Promise<PlatformInviteRow> {
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_company_invites")
    .update({
      status: "accepted",
      accepted_org_id: acceptedOrgId,
      accepted_at: now,
      updated_at: now,
    })
    .eq("id", inviteId)
    .eq("status", "pending")
    .gt("expires_at", now)
    .select(
      "id, org_name, owner_name, owner_email, status, expires_at, created_at, accepted_at, revoked_at, accepted_org_id"
    )
    .maybeSingle();

  if (error) throw new Error(`platform_company_invites consume failed: ${error.message}`);
  if (!data) throw new InviteTokenError("used");
  return data;
}

export async function revokeCompanyInvite(
  platformAdmin: PlatformAdmin,
  inviteId: string
): Promise<PlatformInviteRow> {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("platform_company_invites")
    .select(
      "id, org_name, owner_name, owner_email, status, expires_at, created_at, accepted_at, revoked_at, accepted_org_id"
    )
    .eq("id", inviteId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("الدعوة مش موجودة");
  if (existing.status !== "pending") {
    throw new Error("مفيش غير الدعوات المعلّقة اللي تقدر تلغيها");
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("platform_company_invites")
    .update({
      status: "revoked",
      revoked_by: platformAdmin.id,
      revoked_at: now,
      updated_at: now,
    })
    .eq("id", inviteId)
    .select(
      "id, org_name, owner_name, owner_email, status, expires_at, created_at, accepted_at, revoked_at, accepted_org_id"
    )
    .single();
  if (error) throw new Error(`platform_company_invites revoke failed: ${error.message}`);

  await writePlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: "invite.revoke",
    entityType: "platform_company_invite",
    entityId: inviteId,
    metadata: {
      org_name: data.org_name,
      owner_email: data.owner_email,
    },
  });

  return data;
}

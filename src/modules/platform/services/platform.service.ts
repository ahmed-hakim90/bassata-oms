import { randomBytes, createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, PlatformCompanyInviteRow } from "@/lib/supabase/database.types";
import type { Organization } from "@/lib/types";

export type CompanyStatus = "active" | "suspended";
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface PlatformCompanyMetrics {
  storeCount: number;
  userCount: number;
  productCount: number;
  customerCount: number;
  orderCount: number;
  expenseCount: number;
  purchaseCount: number;
  inventoryMovementCount: number;
  auditLogCount: number;
  databaseBytes: number;
  storageBytes: number;
}

export interface PlatformCompanySummary {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  country: string;
  status: CompanyStatus;
  createdAt: string;
  ownerEmail: string | null;
  ownerName: string | null;
  metrics: PlatformCompanyMetrics;
}

export interface PlatformInvite {
  id: string;
  orgName: string;
  ownerName: string;
  ownerEmail: string;
  status: InviteStatus;
  expiresAt: string;
  acceptedOrgId: string | null;
  createdAt: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

function metricNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mapMetrics(value: Json | null, storageBytes: number): PlatformCompanyMetrics {
  const obj = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    storeCount: metricNumber(obj.store_count),
    userCount: metricNumber(obj.user_count),
    productCount: metricNumber(obj.product_count),
    customerCount: metricNumber(obj.customer_count),
    orderCount: metricNumber(obj.order_count),
    expenseCount: metricNumber(obj.expense_count),
    purchaseCount: metricNumber(obj.purchase_count),
    inventoryMovementCount: metricNumber(obj.inventory_movement_count),
    auditLogCount: metricNumber(obj.audit_log_count),
    databaseBytes: metricNumber(obj.database_bytes),
    storageBytes,
  };
}

function mapInvite(row: PlatformCompanyInviteRow): PlatformInvite {
  return {
    id: row.id,
    orgName: row.org_name,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    status: row.status as InviteStatus,
    expiresAt: row.expires_at,
    acceptedOrgId: row.accepted_org_id,
    createdAt: row.created_at,
  };
}

export async function writePlatformAuditLog(input: {
  platformAdminId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("platform_audit_logs").insert({
    platform_admin_id: input.platformAdminId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: (input.metadata ?? {}) as Json,
  });
  if (error) throw new Error(error.message);
}

async function getOrgStorageBytes(orgId: string): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("org-assets").list(orgId, {
    limit: 1000,
  });
  if (error) return 0;
  return (data ?? []).reduce((sum, item) => {
    const size = item.metadata?.size;
    return sum + (typeof size === "number" ? size : 0);
  }, 0);
}

export async function getCompanyMetrics(orgId: string): Promise<PlatformCompanyMetrics> {
  const admin = createAdminClient();
  const [{ data, error }, storageBytes] = await Promise.all([
    admin.rpc("platform_organization_data_size", { p_org_id: orgId }),
    getOrgStorageBytes(orgId),
  ]);
  if (error) throw new Error(error.message);
  return mapMetrics(data, storageBytes);
}

export async function listCompanies(): Promise<PlatformCompanySummary[]> {
  const admin = createAdminClient();
  const { data: orgs, error } = await admin
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: owners, error: ownerError } = await admin
    .from("users")
    .select("org_id, name, email")
    .eq("role", "owner")
    .eq("is_active", true);
  if (ownerError) throw new Error(ownerError.message);

  const ownerByOrg = new Map(
    (owners ?? []).map((owner) => [
      owner.org_id,
      { name: owner.name as string, email: owner.email as string },
    ])
  );

  return Promise.all(
    (orgs ?? []).map(async (org) => {
      const owner = ownerByOrg.get(org.id);
      return {
        id: org.id,
        name: org.name,
        currency: org.currency,
        timezone: org.timezone,
        country: org.country ?? "",
        status: (org.status ?? "active") as CompanyStatus,
        createdAt: org.created_at,
        ownerEmail: owner?.email ?? null,
        ownerName: owner?.name ?? null,
        metrics: await getCompanyMetrics(org.id),
      };
    })
  );
}

export async function getCompany(orgId: string): Promise<PlatformCompanySummary | null> {
  return (await listCompanies()).find((company) => company.id === orgId) ?? null;
}

export async function updateCompany(
  orgId: string,
  input: Partial<Pick<Organization, "name" | "currency" | "timezone" | "country">> & {
    status?: CompanyStatus;
  },
  platformAdminId: string
): Promise<void> {
  const admin = createAdminClient();
  const update = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.country !== undefined ? { country: input.country } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };
  const { error } = await admin.from("organizations").update(update).eq("id", orgId);
  if (error) throw new Error(error.message);
  await writePlatformAuditLog({
    platformAdminId,
    action: "company.updated",
    entityType: "organization",
    entityId: orgId,
    metadata: update,
  });
}

export async function reassignCompanyOwner(input: {
  orgId: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
  platformAdminId: string;
}): Promise<void> {
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
  const admin = createAdminClient();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.ownerName, role: "owner" },
  });
  if (authError || !authData.user) {
    throw new Error(authError?.message ?? "Failed to create owner auth account");
  }

  const { data: stores, error: storesError } = await admin
    .from("stores")
    .select("id")
    .eq("org_id", input.orgId);
  if (storesError) throw new Error(storesError.message);

  const { error: demoteError } = await admin
    .from("users")
    .update({ role: "manager" })
    .eq("org_id", input.orgId)
    .eq("role", "owner");
  if (demoteError) throw new Error(demoteError.message);

  const { data: appUser, error: userError } = await admin
    .from("users")
    .insert({
      org_id: input.orgId,
      auth_user_id: authData.user.id,
      name: input.ownerName.trim(),
      email: ownerEmail,
      role: "owner",
      is_active: true,
    })
    .select()
    .single();
  if (userError || !appUser) throw new Error(userError?.message ?? "Failed to create owner");

  if (stores?.length) {
    const { error: accessError } = await admin.from("user_store_access").insert(
      stores.map((store) => ({
        user_id: appUser.id,
        store_id: store.id,
      }))
    );
    if (accessError) throw new Error(accessError.message);
  }

  await writePlatformAuditLog({
    platformAdminId: input.platformAdminId,
    action: "company.owner_reassigned",
    entityType: "organization",
    entityId: input.orgId,
    metadata: { ownerEmail },
  });
}

export async function createCompanyInvite(input: {
  orgName: string;
  ownerName: string;
  ownerEmail: string;
  expiresInDays?: number;
  platformAdminId: string;
}): Promise<{ invite: PlatformInvite; token: string }> {
  const admin = createAdminClient();
  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.expiresInDays ?? 14));
  const { data, error } = await admin
    .from("platform_company_invites")
    .insert({
      token_hash: hashToken(token),
      org_name: input.orgName.trim(),
      owner_name: input.ownerName.trim(),
      owner_email: input.ownerEmail.trim().toLowerCase(),
      expires_at: expiresAt.toISOString(),
      created_by: input.platformAdminId,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create invite");
  await writePlatformAuditLog({
    platformAdminId: input.platformAdminId,
    action: "company_invite.created",
    entityType: "platform_company_invite",
    entityId: data.id,
    metadata: { ownerEmail: input.ownerEmail, orgName: input.orgName },
  });
  return { invite: mapInvite(data), token };
}

export async function revokeCompanyInvite(inviteId: string, platformAdminId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("platform_company_invites")
    .update({
      status: "revoked",
      revoked_by: platformAdminId,
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inviteId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  await writePlatformAuditLog({
    platformAdminId,
    action: "company_invite.revoked",
    entityType: "platform_company_invite",
    entityId: inviteId,
  });
}

export async function reissueCompanyInvite(
  inviteId: string,
  platformAdminId: string
): Promise<{ invite: PlatformInvite; token: string }> {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("platform_company_invites")
    .select("*")
    .eq("id", inviteId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Invite not found");

  if (existing.status === "pending") {
    await revokeCompanyInvite(inviteId, platformAdminId);
  }

  const result = await createCompanyInvite({
    orgName: existing.org_name,
    ownerName: existing.owner_name,
    ownerEmail: existing.owner_email,
    platformAdminId,
  });
  await writePlatformAuditLog({
    platformAdminId,
    action: "company_invite.reissued",
    entityType: "platform_company_invite",
    entityId: inviteId,
    metadata: { newInviteId: result.invite.id },
  });
  return result;
}

export async function listCompanyInvites(): Promise<PlatformInvite[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_company_invites")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapInvite);
}

export async function getPendingInviteByToken(token: string): Promise<PlatformInvite | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_company_invites")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (data.status !== "pending") return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await admin
      .from("platform_company_invites")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "pending");
    return null;
  }
  return mapInvite(data);
}

export async function acceptCompanyInvite(input: {
  token: string;
  orgId: string;
  ownerEmail: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_company_invites")
    .update({
      status: "accepted",
      accepted_org_id: input.orgId,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("token_hash", hashToken(input.token))
    .eq("status", "pending")
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Invite could not be accepted");
  await writePlatformAuditLog({
    platformAdminId: data.created_by,
    action: "company_invite.accepted",
    entityType: "platform_company_invite",
    entityId: data.id,
    metadata: { orgId: input.orgId, ownerEmail: input.ownerEmail },
  });
}

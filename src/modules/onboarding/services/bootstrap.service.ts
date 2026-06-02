import { slugifyBranchName } from "@/lib/online-menu-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformBootstrapEmail } from "@/lib/platform/bootstrap";
import {
  mapOnboardingFeaturesToFlags,
  type OnboardingPayload,
} from "@/modules/onboarding/schemas/onboarding.schema";

export class OrganizationAlreadyExistsError extends Error {
  constructor() {
    super("An organization already exists for this deployment.");
    this.name = "OrganizationAlreadyExistsError";
  }
}

export interface BootstrapResult {
  orgId: string;
  storeId: string;
  userId: string;
  ownerEmail: string;
}

export { isPlatformBootstrapEmail };

export async function deploymentHasOrganization(): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("deployment_has_organization");
  if (error) {
    const { count, error: countError } = await admin
      .from("organizations")
      .select("*", { count: "exact", head: true });
    if (countError) throw new Error(countError.message);
    return (count ?? 0) > 0;
  }
  return Boolean(data);
}

async function uploadOrgLogo(
  orgId: string,
  logoDataUrl: string
): Promise<string | null> {
  const match = logoDataUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1]!;
  const buffer = Buffer.from(match[2]!, "base64");
  const ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
          ? "gif"
          : "jpg";

  const admin = createAdminClient();
  const path = `${orgId}/logo.${ext}`;
  const { error } = await admin.storage.from("org-assets").upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw new Error(`Logo upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = admin.storage.from("org-assets").getPublicUrl(path);
  return publicUrl;
}

async function writeBootstrapAuditLog(input: {
  orgId: string;
  storeId?: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert(
    {
      org_id: input.orgId,
      store_id: input.storeId ?? null,
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId,
      metadata: input.metadata ?? {},
    } as never
  );
  if (error) throw new Error(error.message);
}

export async function initializeOrganization(
  input: OnboardingPayload
): Promise<BootstrapResult> {
  if (await deploymentHasOrganization()) {
    throw new OrganizationAlreadyExistsError();
  }

  const admin = createAdminClient();
  const storeCode = slugifyBranchName(input.store.name);
  const featureFlags = mapOnboardingFeaturesToFlags(input.features);

  const { data: initData, error: initError } = await admin.rpc("initialize_organization", {
    p_org_name: input.organization.name,
    p_logo_url: input.organization.logoUrl ?? "",
    p_currency: input.organization.currency,
    p_timezone: input.organization.timezone,
    p_country: input.organization.country,
    p_store_name: input.store.name,
    p_store_code: storeCode,
    p_store_address: input.store.address,
    p_store_phone: input.store.phone ?? "",
    p_store_timezone: input.organization.timezone,
    p_tax_enabled: input.business.taxEnabled,
    p_tax_rate: input.business.taxRate,
    p_tax_inclusive: true,
    p_receipt_header: input.business.receiptHeader ?? "",
    p_receipt_footer: input.business.receiptFooter ?? "",
    p_feature_flags: featureFlags,
  });

  if (initError) {
    if (initError.message.includes("ORGANIZATION_EXISTS")) {
      throw new OrganizationAlreadyExistsError();
    }
    throw new Error(initError.message);
  }

  const result = initData as { org_id: string; store_id: string } | null;
  if (!result?.org_id || !result?.store_id) {
    throw new Error("Bootstrap failed: missing organization identifiers.");
  }

  const orgId = result.org_id;
  const storeId = result.store_id;

  if (input.organization.logoUrl?.startsWith("data:image/")) {
    const logoUrl = await uploadOrgLogo(orgId, input.organization.logoUrl);
    if (logoUrl) {
      await admin.from("organizations").update({ logo_url: logoUrl }).eq("id", orgId);
    }
  }

  const ownerEmail = input.owner.email.trim().toLowerCase();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: input.owner.password,
    email_confirm: true,
    user_metadata: { name: input.owner.name, role: "owner" },
  });

  if (authError || !authData.user) {
    await admin.from("organizations").delete().eq("id", orgId);
    throw new Error(authError?.message ?? "Failed to create owner account.");
  }

  const { data: appUser, error: userError } = await admin
    .from("users")
    .insert({
      org_id: orgId,
      auth_user_id: authData.user.id,
      name: input.owner.name,
      email: ownerEmail,
      role: "owner",
      is_active: true,
    })
    .select()
    .single();

  if (userError || !appUser) {
    await admin.auth.admin.deleteUser(authData.user.id);
    await admin.from("organizations").delete().eq("id", orgId);
    throw new Error(userError?.message ?? "Failed to create owner profile.");
  }

  const { error: accessError } = await admin
    .from("user_store_access")
    .insert({ user_id: appUser.id, store_id: storeId });

  if (accessError) {
    await admin.from("users").delete().eq("id", appUser.id);
    await admin.auth.admin.deleteUser(authData.user.id);
    await admin.from("organizations").delete().eq("id", orgId);
    throw new Error(accessError.message);
  }

  await writeBootstrapAuditLog({
    orgId,
    userId: appUser.id,
    action: "organization.created",
    entityType: "organization",
    entityId: orgId,
    metadata: { name: input.organization.name },
  });

  await writeBootstrapAuditLog({
    orgId,
    storeId,
    userId: appUser.id,
    action: "store.created",
    entityType: "store",
    entityId: storeId,
    metadata: { name: input.store.name },
  });

  await writeBootstrapAuditLog({
    orgId,
    storeId,
    userId: appUser.id,
    action: "onboarding.completed",
    entityType: "organization",
    entityId: orgId,
  });

  return {
    orgId,
    storeId,
    userId: appUser.id,
    ownerEmail,
  };
}

import { slugifyBranchName } from "@/lib/online-menu-path";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapBusinessTypeToActivity,
  mapOnboardingFeaturesToFlags,
  type OnboardingPayload,
} from "@/modules/onboarding/schemas/onboarding.schema";

export class OwnerEmailAlreadyUsedError extends Error {
  constructor() {
    super("This owner email is already used by another company.");
    this.name = "OwnerEmailAlreadyUsedError";
  }
}

export interface BootstrapResult {
  orgId: string;
  storeId: string;
  userId: string;
  ownerEmail: string;
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

async function deleteOrgLogoObject(orgId: string, logoUrl?: string | null): Promise<void> {
  if (!logoUrl) return;
  const pathPrefix = `${orgId}/`;
  const urlParts = logoUrl.split("/object/public/org-assets/");
  if (urlParts.length < 2) return;
  const objectPath = urlParts[1] ?? "";
  if (!objectPath.startsWith(pathPrefix)) return;
  const admin = createAdminClient();
  const { error } = await admin.storage.from("org-assets").remove([objectPath]);
  if (error) {
    throw new Error(`Logo cleanup failed: ${error.message}`);
  }
}

async function rollbackBootstrap(params: {
  orgId: string;
  authUserId?: string;
  appUserId?: string;
  logoUrl?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const cleanupErrors: string[] = [];

  if (params.appUserId) {
    const { error } = await admin.from("users").delete().eq("id", params.appUserId);
    if (error) cleanupErrors.push(`users cleanup failed: ${error.message}`);
  }

  if (params.authUserId) {
    const { error } = await admin.auth.admin.deleteUser(params.authUserId);
    if (error) cleanupErrors.push(`auth user cleanup failed: ${error.message}`);
  }

  try {
    await deleteOrgLogoObject(params.orgId, params.logoUrl);
  } catch (error) {
    cleanupErrors.push(error instanceof Error ? error.message : "logo cleanup failed");
  }

  const { error: orgDeleteError } = await admin.from("organizations").delete().eq("id", params.orgId);
  if (orgDeleteError) cleanupErrors.push(`organization cleanup failed: ${orgDeleteError.message}`);

  if (cleanupErrors.length > 0) {
    throw new Error(cleanupErrors.join(" | "));
  }
}

export async function initializeOrganization(
  input: OnboardingPayload
): Promise<BootstrapResult> {
  const admin = createAdminClient();
  const storeCode = slugifyBranchName(input.store.name);
  const featureFlags = mapOnboardingFeaturesToFlags(input.features);
  const businessActivity = mapBusinessTypeToActivity(input.businessType);
  const ownerEmail = input.owner.email.trim().toLowerCase();

  const { data: existingOwner, error: existingOwnerError } = await admin
    .from("users")
    .select("id")
    .eq("email", ownerEmail)
    .eq("role", "owner")
    .maybeSingle();
  if (existingOwnerError) {
    throw new Error(existingOwnerError.message);
  }
  if (existingOwner) {
    throw new OwnerEmailAlreadyUsedError();
  }

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
    p_store_timezone: input.store.timezone,
    p_tax_enabled: input.organization.taxEnabled,
    p_tax_rate: input.organization.taxRate,
    p_tax_inclusive: input.organization.taxInclusive,
    p_receipt_header: input.defaultSettings.receiptHeader ?? "",
    p_receipt_footer: input.defaultSettings.receiptFooter ?? "",
    p_feature_flags: featureFlags,
    p_business_activity: businessActivity,
    p_session_settings: {
      max_open_hours: input.defaultSettings.sessionRules.maxOpenHours,
      warn_after_hours: Math.min(
        input.defaultSettings.sessionRules.warnAfterHours,
        input.defaultSettings.sessionRules.maxOpenHours
      ),
      block_sales_when_expired: input.defaultSettings.sessionRules.blockSalesWhenExpired,
      require_manager_override_for_expired_sale:
        input.defaultSettings.sessionRules.requireManagerOverrideForExpiredSale,
      allow_manager_force_close: input.defaultSettings.sessionRules.allowManagerForceClose,
    },
    p_expense_settings: {
      approval_required: input.defaultSettings.expenseRules.approvalRequired,
      cashier_can_add_session_expense:
        input.defaultSettings.expenseRules.cashierCanAddSessionExpense,
      allow_inventory_purchase_from_session:
        input.defaultSettings.expenseRules.allowInventoryPurchaseFromSession,
      prevent_expenses_in_closed_periods:
        input.defaultSettings.expenseRules.preventExpensesInClosedPeriods,
    },
    p_payment_methods: {
      payment_cash: input.defaultSettings.paymentMethods.cash,
      payment_card: input.defaultSettings.paymentMethods.card,
      payment_wallet: input.defaultSettings.paymentMethods.wallet,
      payment_credit: input.defaultSettings.paymentMethods.credit,
      payment_other: input.defaultSettings.paymentMethods.manualWallet,
    },
    p_prevent_negative_stock: input.defaultSettings.preventNegativeStock,
    p_default_tax_behavior: input.defaultSettings.defaultTaxBehavior,
    p_seed_defaults: {
      cost_centers: input.initialSetup.createDefaultCostCenters,
      expense_categories: input.initialSetup.createDefaultExpenseCategories,
      product_categories: input.initialSetup.createDefaultProductCategories,
      inventory_units: input.initialSetup.createDefaultInventoryUnits,
      first_pos_device: input.initialSetup.createFirstPosDevice,
      first_pos_device_name: input.initialSetup.firstPosDeviceName?.trim() || "POS-1",
    },
    p_owner_email: ownerEmail,
  });

  if (initError) {
    if (initError.message.includes("OWNER_EMAIL_ALREADY_USED")) {
      throw new OwnerEmailAlreadyUsedError();
    }
    throw new Error(initError.message);
  }

  const result = initData as { org_id: string; store_id: string } | null;
  if (!result?.org_id || !result?.store_id) {
    throw new Error("Bootstrap failed: missing organization identifiers.");
  }

  const orgId = result.org_id;
  const storeId = result.store_id;
  let uploadedLogoUrl: string | null = null;
  let createdAuthUserId: string | undefined;
  let createdAppUserId: string | undefined;

  try {
    if (input.organization.logoUrl?.startsWith("data:image/")) {
      const logoUrl = await uploadOrgLogo(orgId, input.organization.logoUrl);
      if (logoUrl) {
        uploadedLogoUrl = logoUrl;
        const { error: orgLogoUpdateError } = await admin
          .from("organizations")
          .update({ logo_url: logoUrl })
          .eq("id", orgId);
        if (orgLogoUpdateError) {
          throw new Error(orgLogoUpdateError.message);
        }
      }
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: input.owner.password,
      email_confirm: true,
      user_metadata: { name: input.owner.name, role: "owner" },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message ?? "Failed to create owner account.");
    }
    createdAuthUserId = authData.user.id;

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
      throw new Error(userError?.message ?? "Failed to create owner profile.");
    }
    createdAppUserId = appUser.id;

    const { error: accessError } = await admin
      .from("user_store_access")
      .insert({ user_id: appUser.id, store_id: storeId });

    if (accessError) {
      throw new Error(accessError.message);
    }

    try {
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
    } catch {
      // Do not fail completed onboarding because audit logging is unavailable.
    }

    return {
      orgId,
      storeId,
      userId: appUser.id,
      ownerEmail,
    };
  } catch (error) {
    try {
      await rollbackBootstrap({
        orgId,
        authUserId: createdAuthUserId,
        appUserId: createdAppUserId,
        logoUrl: uploadedLogoUrl,
      });
    } catch (rollbackError) {
      const baseMessage =
        error instanceof Error ? error.message : "Onboarding bootstrap failed.";
      const rollbackMessage =
        rollbackError instanceof Error
          ? rollbackError.message
          : "Rollback failed with unknown error.";
      throw new Error(`${baseMessage} | rollback_failed: ${rollbackMessage}`);
    }
    throw error;
  }
}

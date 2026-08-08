import { createAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, ROLES, type UserRole } from "@/lib/constants";
import { sendUserInviteEmail } from "@/lib/services/email.service";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";

export type PlatformTenantUser = {
  id: string;
  org_id: string;
  org_name: string;
  org_status: string;
  auth_user_id: string | null;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string | null;
};

export type PlatformOrgOption = {
  id: string;
  name: string;
  status: string;
};

export type PlatformStoreOption = {
  id: string;
  name: string;
};

function isUserRole(value: string): value is UserRole {
  return (ROLES as readonly string[]).includes(value);
}

async function countActiveOwners(orgId: string, excludeUserId?: string): Promise<number> {
  const admin = createAdminClient();
  let query = admin
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "owner")
    .eq("is_active", true);
  if (excludeUserId) query = query.neq("id", excludeUserId);
  const { count, error } = await query;
  if (error) throw new Error(`تعذر عدّ الملاك: ${error.message}`);
  return count ?? 0;
}

export async function listPlatformTenantUsers(input?: {
  search?: string;
  orgId?: string;
  limit?: number;
}): Promise<PlatformTenantUser[]> {
  const admin = createAdminClient();
  const limit = Math.min(Math.max(input?.limit ?? 200, 1), 500);

  let query = admin
    .from("users")
    .select(
      "id, org_id, auth_user_id, name, email, role, is_active, created_at, organizations!inner(id, name, status)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.orgId) {
    query = query.eq("org_id", input.orgId);
  }

  const search = input?.search?.trim();
  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`تعذر جلب المستخدمين: ${error.message}`);

  return (data ?? []).map((row) => {
    const org = row.organizations as unknown as {
      id: string;
      name: string;
      status: string;
    };
    return {
      id: row.id,
      org_id: row.org_id,
      org_name: org?.name ?? row.org_id,
      org_status: org?.status ?? "active",
      auth_user_id: row.auth_user_id,
      name: row.name,
      email: row.email,
      role: isUserRole(row.role) ? row.role : "cashier",
      is_active: row.is_active,
      created_at: row.created_at,
    };
  });
}

export async function listPlatformOrgOptions(): Promise<PlatformOrgOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id, name, status")
    .order("name", { ascending: true });
  if (error) throw new Error(`تعذر جلب الشركات: ${error.message}`);
  return data ?? [];
}

export async function listPlatformStoresForOrg(orgId: string): Promise<PlatformStoreOption[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stores")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  if (error) throw new Error(`تعذر جلب الفروع: ${error.message}`);
  return data ?? [];
}

export async function setPlatformTenantUserActive(
  platformAdmin: PlatformAdmin,
  userId: string,
  isActive: boolean
): Promise<void> {
  const admin = createAdminClient();
  const { data: user, error } = await admin
    .from("users")
    .select("id, org_id, auth_user_id, role, is_active, email, name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) throw new Error(error?.message ?? "المستخدم غير موجود");

  if (!isActive && user.role === "owner" && user.is_active) {
    const owners = await countActiveOwners(user.org_id, user.id);
    if (owners === 0) {
      throw new Error("لازم يفضل مالك نشط واحد على الأقل في الشركة");
    }
  }

  const { error: updateError } = await admin
    .from("users")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  if (user.auth_user_id) {
    const { error: banError } = await admin.auth.admin.updateUserById(user.auth_user_id, {
      ban_duration: isActive ? "none" : "876000h",
    });
    if (banError) throw new Error(banError.message);
  }

  await auditAs(platformAdmin, {
    action: isActive ? "user.activate" : "user.deactivate",
    entityType: "user",
    entityId: userId,
    metadata: {
      org_id: user.org_id,
      email: user.email,
      name: user.name,
    },
  });

  const { dispatchPlatformWebhook } = await import(
    "@/modules/platform/services/platform-webhooks.service"
  );
  void dispatchPlatformWebhook(
    user.org_id,
    isActive ? "user.activated" : "user.deactivated",
    {
      user_id: userId,
      email: user.email,
      name: user.name,
    }
  );
}

export async function setPlatformTenantUserRole(
  platformAdmin: PlatformAdmin,
  userId: string,
  role: UserRole
): Promise<void> {
  if (!isUserRole(role)) throw new Error("دور غير صالح");

  const admin = createAdminClient();
  const { data: user, error } = await admin
    .from("users")
    .select("id, org_id, role, is_active, email, name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) throw new Error(error?.message ?? "المستخدم غير موجود");

  if (user.role === "owner" && role !== "owner" && user.is_active) {
    const owners = await countActiveOwners(user.org_id, user.id);
    if (owners === 0) {
      throw new Error("لازم يفضل مالك نشط واحد على الأقل في الشركة");
    }
  }

  const { error: updateError } = await admin
    .from("users")
    .update({ role })
    .eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  await auditAs(platformAdmin, {
    action: "user.role_change",
    entityType: "user",
    entityId: userId,
    metadata: {
      org_id: user.org_id,
      email: user.email,
      from_role: user.role,
      to_role: role,
      role_label: ROLE_LABELS[role],
    },
  });
}

export async function resetPlatformTenantUserPassword(
  platformAdmin: PlatformAdmin,
  userId: string,
  password: string
): Promise<void> {
  if (password.length < 8) {
    throw new Error("كلمة المرور لازم 8 أحرف على الأقل");
  }

  const admin = createAdminClient();
  const { data: user, error } = await admin
    .from("users")
    .select("id, org_id, auth_user_id, email, name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) throw new Error(error?.message ?? "المستخدم غير موجود");
  if (!user.auth_user_id) throw new Error("المستخدم مفيش له حساب دخول");

  const { error: authError } = await admin.auth.admin.updateUserById(user.auth_user_id, {
    password,
  });
  if (authError) throw new Error(authError.message);

  await auditAs(platformAdmin, {
    action: "user.password_reset",
    entityType: "user",
    entityId: userId,
    metadata: {
      org_id: user.org_id,
      email: user.email,
      name: user.name,
    },
  });
}

export async function signOutPlatformTenantUser(
  platformAdmin: PlatformAdmin,
  userId: string
): Promise<void> {
  const admin = createAdminClient();
  const { data: user, error } = await admin
    .from("users")
    .select("id, org_id, auth_user_id, email, name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) throw new Error(error?.message ?? "المستخدم غير موجود");
  if (!user.auth_user_id) throw new Error("المستخدم مفيش له حساب دخول");

  // Admin signOut requires a user JWT; temporary ban invalidates refresh tokens.
  const { error: banError } = await admin.auth.admin.updateUserById(user.auth_user_id, {
    ban_duration: "10s",
  });
  if (banError) throw new Error(banError.message);

  const { error: unbanError } = await admin.auth.admin.updateUserById(user.auth_user_id, {
    ban_duration: "none",
  });
  if (unbanError) throw new Error(unbanError.message);

  await auditAs(platformAdmin, {
    action: "user.force_signout",
    entityType: "user",
    entityId: userId,
    metadata: {
      org_id: user.org_id,
      email: user.email,
      name: user.name,
    },
  });
}

export async function createPlatformTenantUser(
  platformAdmin: PlatformAdmin,
  input: {
    orgId: string;
    name: string;
    email: string;
    role: UserRole;
    storeIds: string[];
    password: string;
  }
): Promise<PlatformTenantUser> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error("اسم المستخدم مطلوب");
  if (!email.includes("@")) throw new Error("البريد الإلكتروني غير صالح");
  if (!isUserRole(input.role)) throw new Error("دور غير صالح");
  if (input.password.length < 8) {
    throw new Error("كلمة المرور لازم 8 أحرف على الأقل");
  }
  if (!input.storeIds.length) throw new Error("اختار فرع واحد على الأقل");

  const { assertPlatformCapacity } = await import(
    "@/modules/platform/services/platform-plan.service"
  );
  await assertPlatformCapacity(input.orgId, "users");

  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id, name, status")
    .eq("id", input.orgId)
    .maybeSingle();
  if (orgError || !org) throw new Error(orgError?.message ?? "الشركة غير موجودة");

  const { data: stores, error: storesError } = await admin
    .from("stores")
    .select("id")
    .eq("org_id", input.orgId)
    .in("id", input.storeIds);
  if (storesError) throw new Error(storesError.message);
  if ((stores?.length ?? 0) !== input.storeIds.length) {
    throw new Error("واحد أو أكثر من الفروع مش تابع للشركة");
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name, role: input.role },
  });
  if (authError || !authData.user) {
    throw new Error(authError?.message ?? "فشل إنشاء حساب الدخول");
  }

  const authUserId = authData.user.id;
  let appUserId: string | null = null;

  try {
    const { data: userRow, error: userError } = await admin
      .from("users")
      .insert({
        org_id: input.orgId,
        auth_user_id: authUserId,
        name,
        email,
        role: input.role,
        is_active: true,
      })
      .select("id, org_id, auth_user_id, name, email, role, is_active, created_at")
      .single();

    if (userError || !userRow) {
      throw new Error(userError?.message ?? "فشل إنشاء ملف المستخدم");
    }
    appUserId = userRow.id;

    const accessRows = input.storeIds.map((storeId) => ({
      user_id: userRow.id,
      store_id: storeId,
    }));
    const { error: accessError } = await admin.from("user_store_access").insert(accessRows);
    if (accessError) throw new Error(accessError.message);

    await auditAs(platformAdmin, {
      action: "user.create",
      entityType: "user",
      entityId: userRow.id,
      metadata: {
        org_id: input.orgId,
        email,
        role: input.role,
        store_ids: input.storeIds,
      },
    });

    try {
      await sendUserInviteEmail({
        email,
        recipientName: name,
        orgName: org.name,
        role: input.role,
        orgId: input.orgId,
      });
    } catch (emailError) {
      console.error("[platform] user invite email failed", emailError);
    }

    return {
      id: userRow.id,
      org_id: userRow.org_id,
      org_name: org.name,
      org_status: org.status,
      auth_user_id: userRow.auth_user_id,
      name: userRow.name,
      email: userRow.email,
      role: isUserRole(userRow.role) ? userRow.role : input.role,
      is_active: userRow.is_active,
      created_at: userRow.created_at,
    };
  } catch (error) {
    try {
      if (appUserId) {
        await admin.from("users").delete().eq("id", appUserId);
      }
      await admin.auth.admin.deleteUser(authUserId);
    } catch {
      // Keep primary error.
    }
    throw error;
  }
}

export async function updatePlatformTenantUserProfile(
  platformAdmin: PlatformAdmin,
  userId: string,
  input: { name?: string; email?: string }
): Promise<void> {
  const admin = createAdminClient();
  const { data: user, error } = await admin
    .from("users")
    .select("id, org_id, auth_user_id, name, email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user) throw new Error(error?.message ?? "المستخدم غير موجود");

  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const patch: { name?: string; email?: string } = {};
  if (name) patch.name = name;
  if (email) {
    if (!email.includes("@")) throw new Error("البريد الإلكتروني غير صالح");
    patch.email = email;
  }
  if (!Object.keys(patch).length) return;

  const { error: updateError } = await admin.from("users").update(patch).eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  if (user.auth_user_id && (patch.email || patch.name)) {
    const { error: authError } = await admin.auth.admin.updateUserById(user.auth_user_id, {
      ...(patch.email ? { email: patch.email } : {}),
      ...(patch.name ? { user_metadata: { name: patch.name } } : {}),
    });
    if (authError) throw new Error(authError.message);
  }

  await auditAs(platformAdmin, {
    action: "user.update",
    entityType: "user",
    entityId: userId,
    metadata: {
      org_id: user.org_id,
      ...patch,
    },
  });
}

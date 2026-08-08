import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveStoreId,
  getRegisteredDeviceContext,
  setActiveCashierId,
  setActiveStoreCookie,
  setRegisteredDeviceCookie,
} from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/services/audit.service";
import { assertOnlinePublicRateLimit } from "@/modules/online-menu/lib/online-public-rate-limit";
import {
  buildPosPathForSlug,
  resolveStoreByPosSlug,
  type PosStoreBySlug,
} from "@/lib/tenancy/pos-store-slug";

const DEFAULT_DEVICE_NAME = "كاشير رئيسي";

export type PosPinLoginStoreOption = {
  id: string;
  name: string;
  slug?: string;
};

export type PosPinLoginContext =
  | {
      ok: true;
      orgId: string;
      storeId: string;
      deviceId: string;
      storeSlug: string;
      storeName: string;
      posPath: string;
      stores: PosPinLoginStoreOption[];
    }
  | {
      ok: false;
      reason: "org_required" | "store_required" | "device_failed" | "slug_invalid";
      message: string;
      stores?: PosPinLoginStoreOption[];
      orgId?: string;
    };

function mapRpcError(message: string): string {
  if (message.includes("Too many failed PIN") || message.includes("Too many requests")) {
    return "محاولات كتير — استنى شوية وجرب تاني";
  }
  if (message.includes("Organization suspended")) {
    return "تم تعليق الشركة. تواصل مع الدعم.";
  }
  if (message.includes("Invalid PIN") || message.includes("Invalid PIN login")) {
    return "رقم PIN غير صحيح";
  }
  if (message.includes("Store access denied") || message.includes("Invalid device")) {
    return "الفرع أو نقطة البيع غير جاهزين";
  }
  return "تعذر تسجيل الدخول بـ PIN";
}

/** Silent per-store register row — required by session FK, never shown in UI. */
async function ensureActiveDeviceForStore(
  admin: ReturnType<typeof createAdminClient>,
  storeId: string
): Promise<string> {
  const { data: existing } = await admin
    .from("devices")
    .select("id, name")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("name")
    .limit(20);

  const preferred =
    existing?.find((row) => row.name === DEFAULT_DEVICE_NAME) ?? existing?.[0] ?? null;
  if (preferred) return preferred.id;

  const { hashSecret } = await import("@/lib/repositories/device.repository");
  const crypto = await import("node:crypto");
  const deviceKey = crypto.randomBytes(24).toString("base64url");
  const hash = await hashSecret(deviceKey);
  const { data: created, error } = await admin
    .from("devices")
    .insert({
      store_id: storeId,
      name: DEFAULT_DEVICE_NAME,
      device_key_hash: hash,
      is_active: true,
    })
    .select("id")
    .single();
  if (error || !created) {
    throw new Error("تعذر تجهيز نقطة البيع لهذا الفرع");
  }
  return created.id;
}

async function bindStoreRegister(store: PosStoreBySlug): Promise<{
  orgId: string;
  storeId: string;
  deviceId: string;
  storeSlug: string;
  storeName: string;
  posPath: string;
}> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("status")
    .eq("id", store.orgId)
    .maybeSingle();
  if (!org) throw new Error("الشركة غير موجودة");
  if (org.status === "suspended") throw new Error("تم تعليق الشركة. تواصل مع الدعم.");

  const deviceId = await ensureActiveDeviceForStore(admin, store.id);
  await setActiveStoreCookie(store.id);
  await setRegisteredDeviceCookie({ deviceId, storeId: store.id });

  return {
    orgId: store.orgId,
    storeId: store.id,
    deviceId,
    storeSlug: store.slug,
    storeName: store.name,
    posPath: buildPosPathForSlug(store.slug),
  };
}

/** Bind cookies for a slug POS URL (public or authenticated). */
export async function bindPosStoreFromSlug(storeSlug: string): Promise<PosPinLoginContext> {
  try {
    const store = await resolveStoreByPosSlug(storeSlug);
    if (!store) {
      return {
        ok: false,
        reason: "slug_invalid",
        message: "رابط نقطة البيع غير صحيح. تأكد من الـ slug بتاع الفرع.",
      };
    }
    const bound = await bindStoreRegister(store);
    return {
      ok: true,
      ...bound,
      stores: [{ id: store.id, name: store.name, slug: store.slug }],
    };
  } catch (error) {
    return {
      ok: false,
      reason: "device_failed",
      message:
        error instanceof Error ? error.message : "تعذر تجهيز نقطة البيع لهذا الفرع",
    };
  }
}

/** Prepare org/store/register cookies for the public PIN gate. */
export async function preparePosPinLoginContext(input?: {
  storeId?: string | null;
  storeSlug?: string | null;
}): Promise<PosPinLoginContext> {
  if (input?.storeSlug) {
    return bindPosStoreFromSlug(input.storeSlug);
  }

  // Legacy host/device bootstrap — prefer slug URLs going forward.
  const admin = createAdminClient();
  const deviceCtx = await getRegisteredDeviceContext();
  const activeStoreId = input?.storeId ?? (await getActiveStoreId()) ?? deviceCtx?.storeId;
  if (!activeStoreId) {
    return {
      ok: false,
      reason: "store_required",
      message: "افتح رابط الفرع زي /nutalla/pos (الـ slug من إعدادات الفرع).",
    };
  }

  const { data: storeRow, error } = await admin
    .from("stores")
    .select("id, org_id, name, is_active, settings")
    .eq("id", activeStoreId)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !storeRow) {
    return {
      ok: false,
      reason: "store_required",
      message: "افتح رابط الفرع زي /nutalla/pos (الـ slug من إعدادات الفرع).",
    };
  }

  const settings =
    storeRow.settings && typeof storeRow.settings === "object" && !Array.isArray(storeRow.settings)
      ? (storeRow.settings as Record<string, unknown>)
      : {};
  const slug = String(settings.online_menu_slug ?? "").trim().toLowerCase();
  if (!slug) {
    return {
      ok: false,
      reason: "slug_invalid",
      message: "الفرع محتاج slug من الإعدادات ← الفروع قبل فتح الكاشير.",
    };
  }

  return bindPosStoreFromSlug(slug);
}

/** Verify PIN and mint a full Supabase session for that cashier. */
export async function loginCashierWithPin(input: {
  pin: string;
  storeId?: string | null;
  storeSlug?: string | null;
}): Promise<{ success: true; posPath: string } | { success: false; error: string }> {
  const pin = input.pin.trim();
  if (!/^[0-9]{4,8}$/.test(pin)) {
    return { success: false, error: "أدخل رقم PIN من 4 إلى 8 أرقام" };
  }

  const prepared = await preparePosPinLoginContext({
    storeId: input.storeId,
    storeSlug: input.storeSlug,
  });
  if (!prepared.ok) {
    return { success: false, error: prepared.message };
  }

  try {
    await assertOnlinePublicRateLimit({
      action: "pos_pin_login",
      slug: prepared.storeSlug || `store:${prepared.storeId}`,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "محاولات كتير — استنى شوية",
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("login_cashier_by_pin", {
    p_org_id: prepared.orgId,
    p_store_id: prepared.storeId,
    p_device_id: prepared.deviceId,
    p_pin: pin,
  });

  if (error || !data?.[0]) {
    return { success: false, error: mapRpcError(error?.message ?? "Invalid PIN") };
  }

  const row = data[0] as {
    user_id: string;
    auth_user_id: string;
    email: string;
  };

  if (!row.email || !row.auth_user_id) {
    return { success: false, error: "حساب الكاشير مش مجهز لتسجيل الدخول" };
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: row.email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    console.error("[pos-pin-login] generateLink failed", linkError?.message);
    return { success: false, error: "تعذر فتح جلسة الكاشير" };
  }

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (otpError) {
    const retry = await supabase.auth.verifyOtp({
      type: "email",
      token_hash: linkData.properties.hashed_token,
    });
    if (retry.error) {
      console.error("[pos-pin-login] verifyOtp failed", otpError.message, retry.error.message);
      return { success: false, error: "تعذر فتح جلسة الكاشير" };
    }
  }

  await setActiveStoreCookie(prepared.storeId);
  await setRegisteredDeviceCookie({
    deviceId: prepared.deviceId,
    storeId: prepared.storeId,
  });
  await setActiveCashierId(row.user_id, {
    storeId: prepared.storeId,
    deviceId: prepared.deviceId,
  });

  try {
    await writeAuditLog({
      orgId: prepared.orgId,
      storeId: prepared.storeId,
      userId: row.user_id,
      action: "auth.login",
      entityType: "user",
      entityId: row.user_id,
      metadata: {
        via: "pos_pin",
        storeSlug: prepared.storeSlug,
        email: row.email,
      },
    });
  } catch {
    // audit optional
  }

  return { success: true, posPath: prepared.posPath };
}

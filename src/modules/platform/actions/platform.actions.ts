"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import {
  createCompanyInvite,
  revokeCompanyInvite,
} from "@/modules/platform/services/platform-invite.service";
import { setOrganizationStatus } from "@/modules/platform/services/platform-org.service";

export type PlatformActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function suspendOrganizationAction(
  orgId: string
): Promise<PlatformActionResult> {
  try {
    const admin = await requirePlatformAdmin();
    await setOrganizationStatus(admin, orgId, "suspended");
    revalidatePath("/platform");
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
    revalidatePath("/platform");
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
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إلغاء الدعوة",
    };
  }
}

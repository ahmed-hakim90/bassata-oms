"use server";

import { revalidatePath } from "next/cache";
import { requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import {
  listRecentGlPostingFailures,
  type GlPostingFailure,
} from "@/modules/accounting/services/gl-posting-failures.service";
import { retryFailedGlPosting } from "@/modules/accounting/services/gl-repost.service";

export async function getRecentGlPostingFailuresAction(): Promise<{
  failures: GlPostingFailure[];
  count: number;
}> {
  await requireFeature("general_ledger");
  await requirePermissionOrRole("gl_view", ["owner", "manager"]);
  return listRecentGlPostingFailures(8);
}

export async function retryFailedGlPostingAction(
  auditLogId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireFeature("general_ledger");
    const user = await requirePermissionOrRole("gl_manage", ["owner", "manager"]);
    await retryFailedGlPosting(auditLogId, user.id);
    revalidatePath("/accounting");
    revalidatePath("/accounting/journals");
    revalidatePath("/accounting/accounts");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل إعادة الترحيل",
    };
  }
}

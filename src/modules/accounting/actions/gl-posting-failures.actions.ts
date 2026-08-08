"use server";

import { requireFeature, requirePermissionOrRole } from "@/lib/auth/guards";
import {
  listRecentGlPostingFailures,
  type GlPostingFailure,
} from "@/modules/accounting/services/gl-posting-failures.service";

export async function getRecentGlPostingFailuresAction(): Promise<{
  failures: GlPostingFailure[];
  count: number;
}> {
  await requireFeature("general_ledger");
  await requirePermissionOrRole("gl_view", ["owner", "manager"]);
  return listRecentGlPostingFailures(8);
}

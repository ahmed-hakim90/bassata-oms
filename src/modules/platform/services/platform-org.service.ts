import { createAdminClient } from "@/lib/supabase/admin";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { writePlatformAuditLog } from "@/modules/platform/services/platform-audit.service";

export type PlatformOrganizationRow = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  currency: string;
  country: string;
};

export async function listOrganizationsForPlatform(): Promise<PlatformOrganizationRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id, name, status, created_at, currency, country")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`organizations list failed: ${error.message}`);
  return data ?? [];
}

export async function setOrganizationStatus(
  platformAdmin: PlatformAdmin,
  orgId: string,
  status: "active" | "suspended"
): Promise<PlatformOrganizationRow> {
  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("organizations")
    .select("id, name, status, created_at, currency, country")
    .eq("id", orgId)
    .maybeSingle();
  if (beforeError) throw new Error(beforeError.message);
  if (!before) throw new Error("الشركة مش موجودة");

  if (before.status === status) return before;

  const { data, error } = await admin
    .from("organizations")
    .update({ status })
    .eq("id", orgId)
    .select("id, name, status, created_at, currency, country")
    .single();
  if (error) throw new Error(`organizations status update failed: ${error.message}`);

  await writePlatformAuditLog({
    platformAdminId: platformAdmin.id,
    action: status === "suspended" ? "organization.suspend" : "organization.reactivate",
    entityType: "organization",
    entityId: orgId,
    metadata: {
      org_name: data.name,
      previous_status: before.status,
      new_status: status,
    },
  });

  return data;
}

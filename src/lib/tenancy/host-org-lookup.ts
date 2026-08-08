import { createClient } from "@supabase/supabase-js";
import {
  isReservedHostname,
  normalizeHostname,
  type CustomDomainStatus,
} from "@/lib/tenancy/custom-domain";

export type HostOrgBinding = {
  orgId: string;
  host: string;
  domainStatus: CustomDomainStatus;
  orgStatus: string;
};

type OrgDomainRow = {
  id: string;
  status: string;
  custom_domain: string | null;
  custom_domain_status: string | null;
};

function adminRestClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Resolve hostname → organization for white-label traffic.
 * Service-role only; safe for proxy / server — never expose to client bundles.
 */
export async function lookupOrgByHostname(
  rawHost: string
): Promise<HostOrgBinding | null> {
  const host = normalizeHostname(rawHost);
  if (!host || isReservedHostname(host)) return null;

  const admin = adminRestClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("organizations")
    .select("id, status, custom_domain, custom_domain_status")
    .ilike("custom_domain", host)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as OrgDomainRow;
  const domainStatus = (row.custom_domain_status ?? "none") as CustomDomainStatus;

  return {
    orgId: row.id,
    host,
    domainStatus,
    orgStatus: row.status ?? "active",
  };
}

export async function lookupActiveOrgByHostname(
  rawHost: string
): Promise<HostOrgBinding | null> {
  const binding = await lookupOrgByHostname(rawHost);
  if (!binding) return null;
  if (binding.domainStatus !== "active") return null;
  return binding;
}

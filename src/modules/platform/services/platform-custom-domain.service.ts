import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidCustomDomainHostname,
  normalizeHostname,
  type CustomDomainStatus,
} from "@/lib/tenancy/custom-domain";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";
import { getPlatformPlan } from "@/modules/platform/services/platform-plan.service";

export type OrgCustomDomain = {
  orgId: string;
  domain: string | null;
  status: CustomDomainStatus;
  verifiedAt: string | null;
};

function asStatus(value: unknown): CustomDomainStatus {
  const s = typeof value === "string" ? value : "none";
  if (
    s === "none" ||
    s === "pending_dns" ||
    s === "verifying" ||
    s === "active" ||
    s === "error"
  ) {
    return s;
  }
  return "none";
}

export async function getOrgCustomDomain(orgId: string): Promise<OrgCustomDomain> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id, custom_domain, custom_domain_status, custom_domain_verified_at")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "الشركة غير موجودة");

  return {
    orgId: data.id,
    domain: data.custom_domain ?? null,
    status: asStatus(data.custom_domain_status),
    verifiedAt: data.custom_domain_verified_at ?? null,
  };
}

async function assertDomainPlanAllows(orgId: string): Promise<void> {
  const plan = await getPlatformPlan(orgId);
  if (plan.allow_custom_domain === false) {
    throw new Error("باقة هذه الشركة لا تسمح بدومين مخصص. حدّث الباقة من إعدادات المنصة.");
  }
}

export async function setOrgCustomDomain(
  platformAdmin: PlatformAdmin,
  orgId: string,
  rawDomain: string | null
): Promise<OrgCustomDomain> {
  const admin = createAdminClient();

  if (!rawDomain || !rawDomain.trim()) {
    const { error } = await admin
      .from("organizations")
      .update({
        custom_domain: null,
        custom_domain_status: "none",
        custom_domain_verified_at: null,
      })
      .eq("id", orgId);
    if (error) throw new Error(error.message);

    await auditAs(platformAdmin, {
      action: "org.custom_domain_clear",
      entityType: "organization",
      entityId: orgId,
      metadata: {},
    });
    return getOrgCustomDomain(orgId);
  }

  await assertDomainPlanAllows(orgId);

  const domain = normalizeHostname(rawDomain);
  if (!domain || !isValidCustomDomainHostname(domain)) {
    throw new Error(
      "اسم الدومين غير صالح أو محجوز للمنصة. استخدم hostname فقط مثل pos.client.com"
    );
  }

  const { data: clash } = await admin
    .from("organizations")
    .select("id")
    .ilike("custom_domain", domain)
    .neq("id", orgId)
    .maybeSingle();
  if (clash) {
    throw new Error("هذا الدومين مربوط بشركة أخرى");
  }

  const { error } = await admin
    .from("organizations")
    .update({
      custom_domain: domain,
      custom_domain_status: "pending_dns",
      custom_domain_verified_at: null,
    })
    .eq("id", orgId);
  if (error) {
    if (error.code === "23505") throw new Error("هذا الدومين مربوط بشركة أخرى");
    throw new Error(error.message);
  }

  await auditAs(platformAdmin, {
    action: "org.custom_domain_set",
    entityType: "organization",
    entityId: orgId,
    metadata: { domain, status: "pending_dns" },
  });

  return getOrgCustomDomain(orgId);
}

/**
 * Verify DNS points at this deployment (best-effort CNAME/A check via public DNS over HTTPS).
 * Marks domain active only when hostname resolves; fail closed to `error` otherwise.
 */
export async function verifyOrgCustomDomain(
  platformAdmin: PlatformAdmin,
  orgId: string
): Promise<OrgCustomDomain> {
  const current = await getOrgCustomDomain(orgId);
  if (!current.domain) throw new Error("لا يوجد دومين محفوظ لهذه الشركة");

  await assertDomainPlanAllows(orgId);

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({ custom_domain_status: "verifying" })
    .eq("id", orgId);

  const ok = await probeHostnameResolves(current.domain);
  const nextStatus: CustomDomainStatus = ok ? "active" : "error";
  const verifiedAt = ok ? new Date().toISOString() : null;

  const { error } = await admin
    .from("organizations")
    .update({
      custom_domain_status: nextStatus,
      custom_domain_verified_at: verifiedAt,
    })
    .eq("id", orgId);
  if (error) throw new Error(error.message);

  await auditAs(platformAdmin, {
    action: "org.custom_domain_verify",
    entityType: "organization",
    entityId: orgId,
    metadata: { domain: current.domain, status: nextStatus, ok },
  });

  return getOrgCustomDomain(orgId);
}

async function probeHostnameResolves(hostname: string): Promise<boolean> {
  // Cloudflare DNS-over-HTTPS — no secret; fail closed on network errors.
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
      hostname
    )}&type=A`;
    const res = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { Answer?: unknown[] };
    if (Array.isArray(json.Answer) && json.Answer.length > 0) return true;

    const cnameUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
      hostname
    )}&type=CNAME`;
    const cnameRes = await fetch(cnameUrl, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!cnameRes.ok) return false;
    const cnameJson = (await cnameRes.json()) as { Answer?: unknown[] };
    return Array.isArray(cnameJson.Answer) && cnameJson.Answer.length > 0;
  } catch {
    return false;
  }
}

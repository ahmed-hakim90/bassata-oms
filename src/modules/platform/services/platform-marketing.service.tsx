import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/services/email.service";
import { PlatformBroadcastEmail } from "@/lib/email/templates/platform-broadcast";
import type { PlatformAdmin } from "@/modules/platform/services/platform-admin.service";
import { auditAs } from "@/modules/platform/services/platform-audit.service";

export type BroadcastAudience = "all_owners" | "org_owners" | "org_users";

export type BroadcastResult = {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
};

async function resolveRecipients(input: {
  audience: BroadcastAudience;
  orgId?: string;
}): Promise<{ email: string; orgName: string }[]> {
  const admin = createAdminClient();

  if (input.audience === "all_owners") {
    const { data, error } = await admin
      .from("users")
      .select("email, organizations!inner(name, status)")
      .eq("role", "owner")
      .eq("is_active", true)
      .eq("organizations.status", "active");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const org = row.organizations as unknown as { name: string };
      return { email: row.email, orgName: org?.name ?? "" };
    });
  }

  if (!input.orgId) throw new Error("معرّف الشركة مطلوب لهذا الجمهور");

  let query = admin
    .from("users")
    .select("email, role, organizations!inner(name)")
    .eq("org_id", input.orgId)
    .eq("is_active", true);

  if (input.audience === "org_owners") {
    query = query.eq("role", "owner");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const org = row.organizations as unknown as { name: string };
    return { email: row.email, orgName: org?.name ?? "" };
  });
}

export async function sendPlatformBroadcast(
  platformAdmin: PlatformAdmin,
  input: {
    audience: BroadcastAudience;
    orgId?: string;
    subject: string;
    body: string;
  }
): Promise<BroadcastResult> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 3) throw new Error("عنوان الرسالة قصير جدًا");
  if (body.length < 5) throw new Error("محتوى الرسالة قصير جدًا");

  const recipients = await resolveRecipients({
    audience: input.audience,
    orgId: input.orgId,
  });

  const unique = new Map<string, string>();
  for (const row of recipients) {
    const email = row.email.trim().toLowerCase();
    if (email.includes("@")) unique.set(email, row.orgName);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const [email, orgName] of unique) {
    const result = await sendEmail({
      to: email,
      subject,
      react: (
        <PlatformBroadcastEmail subject={subject} body={body} orgName={orgName} />
      ),
      tags: [
        { name: "category", value: "platform_broadcast" },
        ...(input.orgId ? [{ name: "org_id", value: input.orgId }] : []),
      ],
    });
    if (result.skipped) skipped += 1;
    else if (result.ok) sent += 1;
    else failed += 1;
  }

  await auditAs(platformAdmin, {
    action: "marketing.broadcast",
    entityType: "platform",
    entityId: platformAdmin.id,
    metadata: {
      audience: input.audience,
      org_id: input.orgId ?? null,
      subject,
      attempted: unique.size,
      sent,
      skipped,
      failed,
    },
  });

  return {
    attempted: unique.size,
    sent,
    skipped,
    failed,
  };
}

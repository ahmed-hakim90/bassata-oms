import type { ReactElement } from "react";
import { Resend } from "resend";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  appLoginUrl,
  generateRecoveryActionLink,
  passwordResetRedirectTo,
  platformInviteUrl,
} from "@/lib/email/auth-links";
import { listOwnerEmails } from "@/lib/email/recipients";
import { DiscountOverrideEmail } from "@/lib/email/templates/discount-override";
import { PasswordResetEmail } from "@/lib/email/templates/password-reset";
import { PlatformInviteEmail } from "@/lib/email/templates/platform-invite";
import { SessionClosedEmail } from "@/lib/email/templates/session-closed";
import { UserInviteEmail } from "@/lib/email/templates/user-invite";
import { WelcomeOnboardingEmail } from "@/lib/email/templates/welcome-onboarding";
import type { CashierSession } from "@/lib/types";

export type SendEmailResult = {
  ok: boolean;
  skipped?: boolean;
  id?: string;
};

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  react: ReactElement;
  tags?: { name: string; value: string }[];
  replyTo?: string;
};

function normalizeRecipients(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return [
    ...new Set(
      list
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes("@"))
    ),
  ];
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const recipients = normalizeRecipients(input.to);

  if (!recipients.length) {
    return { ok: false, skipped: true };
  }

  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY or EMAIL_FROM missing — skip send", {
      subject: input.subject,
      toCount: recipients.length,
    });
    return { ok: false, skipped: true };
  }

  try {
    const resend = new Resend(apiKey);
    const replyTo =
      input.replyTo?.trim() || process.env.EMAIL_REPLY_TO?.trim() || undefined;

    const { data, error } = await resend.emails.send({
      from,
      to: recipients,
      subject: input.subject,
      react: input.react,
      ...(replyTo ? { replyTo } : {}),
      ...(input.tags?.length ? { tags: input.tags } : {}),
    });

    if (error) {
      console.error("[email] Resend error", error);
      return { ok: false };
    }

    return { ok: true, id: data?.id };
  } catch (error) {
    console.error("[email] send failed", error);
    return { ok: false };
  }
}

export async function sendPasswordResetEmail(input: {
  email: string;
  origin?: string;
}): Promise<SendEmailResult> {
  const resetUrl = await generateRecoveryActionLink(
    input.email,
    passwordResetRedirectTo(input.origin)
  );
  if (!resetUrl) {
    return { ok: false, skipped: true };
  }

  return sendEmail({
    to: input.email,
    subject: "إعادة تعيين كلمة المرور — Velora",
    react: <PasswordResetEmail resetUrl={resetUrl} />,
    tags: [
      { name: "category", value: "password_reset" },
    ],
  });
}

export async function sendUserInviteEmail(input: {
  email: string;
  recipientName: string;
  orgName: string;
  role: UserRole;
  orgId?: string;
}): Promise<SendEmailResult> {
  const setPasswordUrl = await generateRecoveryActionLink(input.email);
  if (!setPasswordUrl) {
    return { ok: false, skipped: true };
  }

  return sendEmail({
    to: input.email,
    subject: `دعوة للانضمام إلى ${input.orgName} — Velora`,
    react: (
      <UserInviteEmail
        recipientName={input.recipientName}
        orgName={input.orgName}
        roleLabel={ROLE_LABELS[input.role]}
        loginUrl={appLoginUrl()}
        setPasswordUrl={setPasswordUrl}
      />
    ),
    tags: [
      { name: "category", value: "user_invite" },
      ...(input.orgId ? [{ name: "org_id", value: input.orgId }] : []),
    ],
  });
}

export async function sendWelcomeOnboardingEmail(input: {
  email: string;
  ownerName: string;
  orgName: string;
  orgId?: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: input.email,
    subject: `مرحباً بك في Velora — ${input.orgName}`,
    react: (
      <WelcomeOnboardingEmail
        ownerName={input.ownerName}
        orgName={input.orgName}
        loginUrl={appLoginUrl()}
      />
    ),
    tags: [
      { name: "category", value: "welcome" },
      ...(input.orgId ? [{ name: "org_id", value: input.orgId }] : []),
    ],
  });
}

export async function sendPlatformInviteEmail(input: {
  email: string;
  ownerName?: string;
  orgName: string;
  token: string;
  expiresAt: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: input.email,
    subject: `دعوة لإنشاء ${input.orgName} على Velora`,
    react: (
      <PlatformInviteEmail
        ownerName={input.ownerName}
        orgName={input.orgName}
        inviteUrl={platformInviteUrl(input.token)}
        expiresAtLabel={formatDateTime(input.expiresAt)}
      />
    ),
    tags: [{ name: "category", value: "platform_invite" }],
  });
}

export async function notifyOwnersSessionClosed(input: {
  orgId: string;
  session: CashierSession;
  storeName: string;
  cashierName: string;
  currency?: string;
}): Promise<void> {
  try {
    const owners = await listOwnerEmails(input.orgId);
    if (!owners.length) return;

    const currency = input.currency ?? "EGP";
    const variance = input.session.variance ?? 0;
    const varianceNotable =
      input.session.force_closed || Math.abs(variance) > 0.009;

    await sendEmail({
      to: owners,
      subject: input.session.force_closed
        ? `إغلاق إجباري — ${input.storeName}`
        : `إغلاق وردية — ${input.storeName}`,
      react: (
        <SessionClosedEmail
          storeName={input.storeName}
          cashierName={input.cashierName}
          openedAtLabel={formatDateTime(input.session.opened_at)}
          closedAtLabel={
            input.session.closed_at
              ? formatDateTime(input.session.closed_at)
              : "—"
          }
          openingCashLabel={formatCurrency(input.session.opening_cash, currency)}
          expectedCashLabel={formatCurrency(
            input.session.expected_cash ?? 0,
            currency
          )}
          actualCashLabel={formatCurrency(
            input.session.actual_cash ?? 0,
            currency
          )}
          varianceLabel={formatCurrency(variance, currency)}
          varianceNotable={varianceNotable}
          forceClosed={input.session.force_closed}
          closeReason={input.session.close_reason}
        />
      ),
      tags: [
        { name: "category", value: "session_closed" },
        { name: "org_id", value: input.orgId },
      ],
    });
  } catch (error) {
    console.error("[email] notifyOwnersSessionClosed failed", error);
  }
}

export async function notifyOwnersDiscountOverride(input: {
  orgId: string;
  storeName: string;
  cashierName: string;
  approverName: string;
  discount: number;
  threshold: number | null;
  reason?: string | null;
  sessionId: string;
  currency?: string;
}): Promise<void> {
  try {
    const owners = await listOwnerEmails(input.orgId);
    if (!owners.length) return;

    const currency = input.currency ?? "EGP";
    const thresholdLabel =
      input.threshold == null
        ? "—"
        : formatCurrency(input.threshold, currency);

    await sendEmail({
      to: owners,
      subject: `خصم بتجاوز المدير — ${input.storeName}`,
      react: (
        <DiscountOverrideEmail
          storeName={input.storeName}
          cashierName={input.cashierName}
          approverName={input.approverName}
          discountLabel={formatCurrency(input.discount, currency)}
          thresholdLabel={thresholdLabel}
          reason={input.reason}
          sessionId={input.sessionId}
        />
      ),
      tags: [
        { name: "category", value: "discount_override" },
        { name: "org_id", value: input.orgId },
      ],
    });
  } catch (error) {
    console.error("[email] notifyOwnersDiscountOverride failed", error);
  }
}

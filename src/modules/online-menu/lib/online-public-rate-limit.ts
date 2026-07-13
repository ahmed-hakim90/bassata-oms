import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";

export type OnlinePublicRateAction = "menu" | "order_create";

const LIMITS: Record<OnlinePublicRateAction, { max: number; windowSeconds: number }> = {
  menu: { max: 60, windowSeconds: 60 },
  order_create: { max: 8, windowSeconds: 60 },
};

function clientIpFromHeaders(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 80);
  return "unknown";
}

export async function resolvePublicClientKey(slug?: string): Promise<string> {
  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);
  const slugPart = (slug?.trim().toLowerCase() || "noslug").slice(0, 80);
  return `${ip}:${slugPart}`;
}

/**
 * Enforce + record public online abuse limits via Postgres RPC.
 * Throws Arabic operator-facing message when limited.
 */
export async function assertOnlinePublicRateLimit(input: {
  action: OnlinePublicRateAction;
  slug?: string;
  bucketKey?: string;
}): Promise<void> {
  const bucketKey = input.bucketKey ?? (await resolvePublicClientKey(input.slug));
  const limits = LIMITS[input.action];
  const admin = createAdminClient();

  const { error } = await admin.rpc("assert_and_record_online_public_rate_limit", {
    p_bucket_key: bucketKey,
    p_action: input.action,
    p_max_events: limits.max,
    p_window_seconds: limits.windowSeconds,
  });

  if (!error) return;

  const message = error.message ?? "";
  if (message.includes("Too many requests")) {
    throw new Error("طلبات كثيرة جدًا — حاول مرة أخرى بعد دقيقة");
  }

  // Menu reads: fail open on infra/transient errors so a DNS/network blip
  // does not 500 the public menu. Abuse limit still applies when RPC works.
  // Order create: fail closed — never accept orders when limiter is unavailable.
  if (input.action === "menu") {
    console.warn(
      "[online-public-rate-limit] menu check skipped (infra error):",
      message
    );
    return;
  }

  throw new Error("تعذر التحقق من الحد المسموح للطلبات — حاول لاحقاً");
}

/** Pure helper for unit tests — exposed limits. */
export function getOnlinePublicRateLimits() {
  return LIMITS;
}

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeOnlineMenuViewSource,
  type OnlineMenuViewSource,
} from "@/modules/online-menu/lib/online-menu-view-source";

export type OnlineMenuViewStatRow = {
  source: OnlineMenuViewSource;
  viewCount: number;
};

export type OnlineMenuViewStats = {
  days: number;
  total: number;
  bySource: OnlineMenuViewStatRow[];
};

/**
 * Record a public menu open. Fail-open — analytics must never break the menu.
 * org/store are resolved inside the SECURITY DEFINER RPC from slug (or host org).
 */
export async function recordOnlineMenuView(input: {
  slug?: string | null;
  orgId?: string | null;
  source?: string | null;
}): Promise<void> {
  const slug = String(input.slug ?? "").trim().toLowerCase();
  const orgId = input.orgId?.trim() || null;
  if (!slug && !orgId) return;

  const source = normalizeOnlineMenuViewSource(input.source);
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("record_online_menu_view", {
      p_slug: slug || "",
      p_source: source,
      p_org_id: orgId,
    });
    if (error) {
      console.warn("[online-menu-views] record skipped:", error.message);
    }
  } catch (error) {
    console.warn("[online-menu-views] record failed:", error);
  }
}

export async function getOnlineMenuViewStats(
  storeId: string,
  days = 7
): Promise<OnlineMenuViewStats> {
  const boundedDays = Math.min(90, Math.max(1, days));
  const empty: OnlineMenuViewStats = { days: boundedDays, total: 0, bySource: [] };
  if (!storeId) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_online_menu_view_stats", {
    p_store_id: storeId,
    p_days: boundedDays,
  });

  if (error) {
    console.warn("[online-menu-views] stats failed:", error.message);
    return empty;
  }

  const bySource: OnlineMenuViewStatRow[] = (data ?? []).map((row) => ({
    source: normalizeOnlineMenuViewSource(row.source),
    viewCount: Number(row.view_count) || 0,
  }));
  const total = bySource.reduce((sum, row) => sum + row.viewCount, 0);
  return { days: boundedDays, total, bySource };
}

export async function getOnlineMenuViewStatsByStoreIds(
  storeIds: string[],
  days = 7
): Promise<Record<string, OnlineMenuViewStats>> {
  const unique = [...new Set(storeIds.filter(Boolean))];
  const entries = await Promise.all(
    unique.map(async (storeId) => [storeId, await getOnlineMenuViewStats(storeId, days)] as const)
  );
  return Object.fromEntries(entries);
}

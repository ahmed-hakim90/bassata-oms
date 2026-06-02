import * as sessionRepo from "@/lib/repositories/session.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as storeRepo from "@/lib/repositories/store.repository";

export interface SessionKpi {
  openSessions: number;
  closedSessions: number;
  totalVariance: number;
  avgVariance: number;
  sessionsByCashier: {
    cashierId: string;
    cashierName: string;
    sessionCount: number;
    totalVariance: number;
  }[];
  recentSessions: {
    id: string;
    cashierName: string;
    storeName: string;
    openedAt: string;
    closedAt: string | null;
    variance: number | null;
    status: string;
  }[];
}

export async function getSessionReport(
  storeId?: string,
  days = 30
): Promise<SessionKpi> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const sessions = (await sessionRepo.listSessions(storeId)).filter(
    (s) => new Date(s.opened_at) >= cutoff
  );

  const users = await userRepo.listUsers();
  const stores = await storeRepo.listStores();
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  const openSessions = sessions.filter((s) => s.status === "open").length;
  const closed = sessions.filter((s) => s.status === "closed");
  const closedSessions = closed.length;
  const totalVariance = closed.reduce((s, sess) => s + (sess.variance ?? 0), 0);
  const avgVariance = closedSessions > 0 ? totalVariance / closedSessions : 0;

  const cashierMap = new Map<string, { sessionCount: number; totalVariance: number }>();
  for (const session of closed) {
    const existing = cashierMap.get(session.cashier_id) ?? {
      sessionCount: 0,
      totalVariance: 0,
    };
    existing.sessionCount += 1;
    existing.totalVariance += session.variance ?? 0;
    cashierMap.set(session.cashier_id, existing);
  }

  const sessionsByCashier = [...cashierMap.entries()].map(([cashierId, data]) => ({
    cashierId,
    cashierName: userMap.get(cashierId) ?? "Unknown",
    ...data,
  }));

  const recentSessions = sessions.slice(0, 10).map((s) => ({
    id: s.id,
    cashierName: userMap.get(s.cashier_id) ?? "Unknown",
    storeName: storeMap.get(s.store_id) ?? "Unknown",
    openedAt: s.opened_at,
    closedAt: s.closed_at,
    variance: s.variance,
    status: s.status,
  }));

  return {
    openSessions,
    closedSessions,
    totalVariance,
    avgVariance,
    sessionsByCashier,
    recentSessions,
  };
}

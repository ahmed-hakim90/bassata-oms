import * as sessionRepo from "@/lib/repositories/session.repository";
import * as userRepo from "@/lib/repositories/user.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as reportRepo from "@/lib/repositories/report.repository";
import { calcExpectedCash } from "@/modules/sessions/services/reconciliation.service";

export interface DailyCloseSessionRow {
  id: string;
  cashierName: string;
  storeName: string;
  storeId: string;
  openedAt: string;
  closedAt: string | null;
  status: string;
  openingCash: number;
  cashSales: number;
  cardSales: number;
  walletSales: number;
  creditSales: number;
  cashRefunds: number;
  expenses: number;
  expectedCash: number;
  actualCash: number | null;
  variance: number | null;
  forceClosed: boolean;
}

export interface DailyCloseReport {
  businessDay: string;
  rangeFrom: string;
  rangeTo: string;
  closedCount: number;
  openCount: number;
  totals: {
    openingCash: number;
    cashSales: number;
    cardSales: number;
    walletSales: number;
    creditSales: number;
    cashRefunds: number;
    expenses: number;
    expectedCash: number;
    actualCash: number;
    variance: number;
  };
  sessions: DailyCloseSessionRow[];
  openSessions: DailyCloseSessionRow[];
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function inRange(iso: string, from: Date, to: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

async function reconcileSession(sessionId: string, openingCash: number) {
  try {
    return await reportRepo.getSessionReconciliationRpc(sessionId);
  } catch {
    const legacy = await calcExpectedCash(sessionId);
    return {
      openingCash: legacy.openingCash || openingCash,
      cashSales: legacy.cashSales,
      cardSales: 0,
      walletSales: 0,
      creditSales: 0,
      cashRefunds: legacy.cashRefunds,
      expenses: legacy.expenses,
      customerPayments: 0,
      expectedCash: legacy.expectedCash,
    };
  }
}

/**
 * Owner daily close: sessions closed in the date window, with cash lines
 * matching session close / `report_session_reconciliation`.
 */
export async function getDailyCloseReport(options: {
  storeId?: string;
  from: Date;
  to: Date;
}): Promise<DailyCloseReport> {
  const rangeFrom = options.from.toISOString();
  const rangeTo = options.to.toISOString();
  const businessDay = dayKey(rangeTo);

  const [sessions, users, stores] = await Promise.all([
    sessionRepo.listSessions(options.storeId),
    userRepo.listUsers(),
    storeRepo.listStores(),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  const closedInRange = sessions.filter(
    (s) =>
      s.status === "closed" &&
      s.closed_at != null &&
      inRange(s.closed_at, options.from, options.to)
  );
  const openNow = sessions.filter(
    (s) =>
      s.status === "open" &&
      (!options.storeId || s.store_id === options.storeId)
  );

  const closedRows: DailyCloseSessionRow[] = [];
  for (const session of closedInRange) {
    const recon = await reconcileSession(session.id, session.opening_cash);
    const expected =
      session.expected_cash != null ? session.expected_cash : recon.expectedCash;
    const variance =
      session.variance != null
        ? session.variance
        : session.actual_cash != null
          ? session.actual_cash - expected
          : null;
    closedRows.push({
      id: session.id,
      cashierName: userMap.get(session.cashier_id) ?? "—",
      storeName: storeMap.get(session.store_id) ?? "—",
      storeId: session.store_id,
      openedAt: session.opened_at,
      closedAt: session.closed_at,
      status: session.status,
      openingCash: recon.openingCash,
      cashSales: recon.cashSales,
      cardSales: recon.cardSales,
      walletSales: recon.walletSales,
      creditSales: recon.creditSales,
      cashRefunds: recon.cashRefunds,
      expenses: recon.expenses,
      expectedCash: expected,
      actualCash: session.actual_cash,
      variance,
      forceClosed: session.force_closed,
    });
  }

  const openRows: DailyCloseSessionRow[] = [];
  for (const session of openNow) {
    const recon = await reconcileSession(session.id, session.opening_cash);
    openRows.push({
      id: session.id,
      cashierName: userMap.get(session.cashier_id) ?? "—",
      storeName: storeMap.get(session.store_id) ?? "—",
      storeId: session.store_id,
      openedAt: session.opened_at,
      closedAt: null,
      status: session.status,
      openingCash: recon.openingCash,
      cashSales: recon.cashSales,
      cardSales: recon.cardSales,
      walletSales: recon.walletSales,
      creditSales: recon.creditSales,
      cashRefunds: recon.cashRefunds,
      expenses: recon.expenses,
      expectedCash: recon.expectedCash,
      actualCash: null,
      variance: null,
      forceClosed: false,
    });
  }

  const totals = closedRows.reduce(
    (acc, row) => {
      acc.openingCash += row.openingCash;
      acc.cashSales += row.cashSales;
      acc.cardSales += row.cardSales;
      acc.walletSales += row.walletSales;
      acc.creditSales += row.creditSales;
      acc.cashRefunds += row.cashRefunds;
      acc.expenses += row.expenses;
      acc.expectedCash += row.expectedCash;
      acc.actualCash += row.actualCash ?? 0;
      acc.variance += row.variance ?? 0;
      return acc;
    },
    {
      openingCash: 0,
      cashSales: 0,
      cardSales: 0,
      walletSales: 0,
      creditSales: 0,
      cashRefunds: 0,
      expenses: 0,
      expectedCash: 0,
      actualCash: 0,
      variance: 0,
    }
  );

  return {
    businessDay,
    rangeFrom,
    rangeTo,
    closedCount: closedRows.length,
    openCount: openRows.length,
    totals,
    sessions: closedRows,
    openSessions: openRows,
  };
}

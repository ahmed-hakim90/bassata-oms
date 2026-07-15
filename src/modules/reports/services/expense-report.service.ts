import * as expenseRepo from "@/lib/repositories/expense.repository";
import * as costCenterRepo from "@/lib/repositories/cost-center.repository";
import * as categoryRepo from "@/lib/repositories/expense-category.repository";
import * as sessionRepo from "@/lib/repositories/session.repository";
import * as storeRepo from "@/lib/repositories/store.repository";
import * as userRepo from "@/lib/repositories/user.repository";

function dateRange(options?: { days?: number; from?: string; to?: string }) {
  const days = options?.days ?? 30;
  let from: string;
  let to: string;
  if (options?.from) {
    from = options.from;
    to = options.to ?? new Date().toISOString().slice(0, 10);
  } else {
    const start = new Date();
    start.setDate(start.getDate() - days);
    from = start.toISOString().slice(0, 10);
    to = new Date().toISOString().slice(0, 10);
  }
  return { from, to };
}

export async function getExpensesByCostCenter(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  const { from, to } = dateRange(options);
  const centers = await costCenterRepo.listCostCenters(options?.storeId);
  const centerMap = new Map(centers.map((c) => [c.id, c.name]));
  const totals = await expenseRepo.sumExpensesByCostCenter({
    storeId: options?.storeId,
    from,
    to,
    status: "approved",
  });
  const grandTotal = totals.reduce((s, t) => s + t.amount, 0);
  return totals
    .map((t) => ({
      costCenterId: t.costCenterId,
      name: centerMap.get(t.costCenterId) ?? "غير معروف",
      amount: t.amount,
      percentage: grandTotal > 0 ? (t.amount / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getExpensesByCategory(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  const { from, to } = dateRange(options);
  const categories = await categoryRepo.listExpenseCategories();
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const totals = await expenseRepo.sumExpensesByCategory({
    storeId: options?.storeId,
    from,
    to,
    status: "approved",
  });
  return totals
    .map((t) => ({
      categoryId: t.categoryId,
      name: categoryMap.get(t.categoryId) ?? "Unknown",
      amount: t.amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getExpensesByStore(options?: {
  days?: number;
  from?: string;
  to?: string;
}) {
  const { from, to } = dateRange(options);
  const stores = await storeRepo.listStores();
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const expenses = await expenseRepo.listExpenses({ from, to, status: "approved" });
  const totals = new Map<string, number>();
  for (const e of expenses) {
    totals.set(e.store_id, (totals.get(e.store_id) ?? 0) + e.amount);
  }
  const grandTotal = [...totals.values()].reduce((s, n) => s + n, 0);
  return [...totals.entries()]
    .map(([storeId, amount]) => ({
      storeId,
      storeName: storeMap.get(storeId) ?? "Unknown",
      amount,
      percentage: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function getSessionExpensesReport(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  const { from, to } = dateRange(options);
  const expenses = await expenseRepo.listExpenses({
    storeId: options?.storeId,
    from,
    to,
  }).then((list) => list.filter((e) => e.session_id));

  const sessionIds = [...new Set(expenses.map((e) => e.session_id!).filter(Boolean))];
  const sessions = await Promise.all(sessionIds.map((id) => sessionRepo.getSession(id)));
  const sessionMap = new Map(sessions.filter(Boolean).map((s) => [s!.id, s!]));
  const users = await userRepo.listUsers();
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const bySession = new Map<
    string,
    { sessionId: string; cashierName: string; total: number; expenses: typeof expenses }
  >();

  for (const e of expenses) {
    if (!e.session_id) continue;
    const session = sessionMap.get(e.session_id);
    const existing = bySession.get(e.session_id) ?? {
      sessionId: e.session_id,
      cashierName: userMap.get(session?.cashier_id ?? "") ?? "Unknown",
      total: 0,
      expenses: [],
    };
    existing.total += e.amount;
    existing.expenses.push(e);
    bySession.set(e.session_id, existing);
  }

  return [...bySession.values()].sort((a, b) => b.total - a.total);
}

export async function getTopExpenses(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  const byCenter = await getExpensesByCostCenter(options);
  const byCategory = await getExpensesByCategory(options);
  const { from, to } = dateRange(options);
  const expenses = await expenseRepo.listExpenses({
    storeId: options?.storeId,
    from,
    to,
    status: "approved",
  });
  const topSingle = [...expenses].sort((a, b) => b.amount - a.amount)[0] ?? null;
  return {
    highestCostCenter: byCenter[0] ?? null,
    highestCategory: byCategory[0] ?? null,
    highestSingle: topSingle,
  };
}

export async function getTotalExpenses(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  const { from, to } = dateRange(options);
  const expenses = await expenseRepo.listExpenses({
    storeId: options?.storeId,
    from,
    to,
    status: "approved",
  });
  return expenses.reduce((s, e) => s + e.amount, 0);
}

function priorDateRange(options?: { days?: number; from?: string; to?: string }) {
  const days = options?.days ?? 30;
  if (options?.from && options?.to) {
    const start = new Date(options.from);
    const end = new Date(`${options.to}T23:59:59`);
    const span = end.getTime() - start.getTime();
    const priorEnd = new Date(start.getTime() - 1);
    const priorStart = new Date(priorEnd.getTime() - span);
    return {
      from: priorStart.toISOString().slice(0, 10),
      to: priorEnd.toISOString().slice(0, 10),
    };
  }
  const end = new Date();
  end.setDate(end.getDate() - days);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export async function getExpensesByCategoryWithTrend(options?: {
  storeId?: string;
  days?: number;
  from?: string;
  to?: string;
}) {
  const current = await getExpensesByCategory(options);
  const priorRange = priorDateRange(options);
  const prior = await getExpensesByCategory({
    storeId: options?.storeId,
    from: priorRange.from,
    to: priorRange.to,
  });
  const priorMap = new Map(prior.map((p) => [p.categoryId, p.amount]));
  return current.map((c) => {
    const prev = priorMap.get(c.categoryId) ?? 0;
    const trendPct = prev > 0 ? ((c.amount - prev) / prev) * 100 : c.amount > 0 ? 100 : 0;
    return { ...c, priorAmount: prev, trendPct };
  });
}

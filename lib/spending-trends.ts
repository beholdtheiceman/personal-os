import { getAdminDb } from "@/lib/firebase-admin";

export interface CategoryTrend {
  category: string;
  spent: number;
  limit: number;
  projectedTotal: number;
  overspendAmount: number;
  percentUsed: number;
  daysElapsed: number;
  daysInMonth: number;
}

export async function getSpendingTrends(
  uid: string,
  localDate?: string
): Promise<CategoryTrend[]> {
  const db = getAdminDb();
  const today = localDate ?? new Date().toLocaleDateString("en-CA");
  const currentMonth = today.slice(0, 7); // YYYY-MM

  const [year, month] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysElapsed = Number(today.slice(8, 10));

  if (daysElapsed === 0) return [];

  const budgetDoc = await db.doc(`users/${uid}/budgets/${currentMonth}`).get();
  if (!budgetDoc.exists) return [];

  const categories = (budgetDoc.data()?.categories ?? {}) as Record<
    string,
    { limit: number; alert_threshold: number }
  >;

  const monthStart = `${currentMonth}-01`;
  const monthEnd = `${currentMonth}-31`;

  const txSnap = await db
    .collection(`users/${uid}/transactions`)
    .where("date", ">=", monthStart)
    .where("date", "<=", monthEnd)
    .get();

  const actuals: Record<string, number> = {};
  for (const d of txSnap.docs) {
    const tx = d.data();
    if (tx.type !== "expense") continue;
    const cat = tx.category as string;
    actuals[cat] = (actuals[cat] ?? 0) + (tx.amount as number);
  }

  const trends: CategoryTrend[] = [];

  for (const [category, { limit }] of Object.entries(categories)) {
    if (limit <= 0) continue;
    const spent = actuals[category] ?? 0;
    const projectedTotal = (spent / daysElapsed) * daysInMonth;
    const overspendAmount = Math.max(0, projectedTotal - limit);
    const percentUsed = spent / limit;

    trends.push({
      category,
      spent,
      limit,
      projectedTotal,
      overspendAmount,
      percentUsed,
      daysElapsed,
      daysInMonth,
    });
  }

  return trends.sort((a, b) => b.overspendAmount - a.overspendAmount);
}

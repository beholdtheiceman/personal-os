"use client";
import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { calcFiNumber, calcMonthsToFi } from "@/lib/fire-calculator";
import type { FireAssumptions, FireProjection } from "@/types";

const DEFAULT_ASSUMPTIONS: FireAssumptions = {
  expected_return: 0.07,
  withdrawal_rate: 0.04,
  updated_at: new Date().toISOString(),
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Returns avg monthly totals for income and expenses over the last 3 months of transactions. */
function calcAvgMonthly(
  txns: { date: string; type: string; amount: number }[]
): { avgExpenses: number; avgIncome: number } {
  const buckets: Record<string, { expenses: number; income: number }> = {};
  for (const t of txns) {
    const month = t.date.slice(0, 7);
    if (!buckets[month]) buckets[month] = { expenses: 0, income: 0 };
    if (t.type === "expense") buckets[month].expenses += t.amount;
    else if (t.type === "income") buckets[month].income += t.amount;
  }
  const months = Object.values(buckets);
  if (months.length === 0) return { avgExpenses: 0, avgIncome: 0 };
  const avgExpenses = months.reduce((s, m) => s + m.expenses, 0) / months.length;
  const avgIncome = months.reduce((s, m) => s + m.income, 0) / months.length;
  return { avgExpenses, avgIncome };
}

export function useFireProjection() {
  const { user } = useAuth();
  const [projection, setProjection] = useState<FireProjection | null>(null);
  const [assumptions, setAssumptions] = useState<FireAssumptions>(DEFAULT_ASSUMPTIONS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      // Latest net worth snapshot
      const nwQ = query(
        collection(db, `users/${user.uid}/net_worth`),
        orderBy("snapshot_date", "desc"),
        limit(1)
      );
      const nwSnap = await getDocs(nwQ);
      const currentNetWorth: number = nwSnap.empty ? 0 : (nwSnap.docs[0].data().net_worth as number);

      // Last 3 months of transactions
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      const txnQ = query(
        collection(db, `users/${user.uid}/transactions`),
        orderBy("date", "desc"),
        limit(300)
      );
      const txnSnap = await getDocs(txnQ);
      const cutoff = threeMonthsAgo.toISOString().slice(0, 10);
      const recent = txnSnap.docs
        .map((d) => d.data() as { date: string; type: string; amount: number })
        .filter((t) => t.date >= cutoff);
      const { avgExpenses, avgIncome } = calcAvgMonthly(recent);

      // FIRE assumptions doc
      const assumDoc = await getDoc(doc(db, `users/${user.uid}/settings/fire`));
      const stored = assumDoc.exists()
        ? (assumDoc.data() as FireAssumptions)
        : DEFAULT_ASSUMPTIONS;
      setAssumptions(stored);

      const annualExpenses = stored.annual_expenses ?? avgExpenses * 12;
      const monthlySavings = stored.savings_rate ?? Math.max(0, avgIncome - avgExpenses);
      const fiNumber = calcFiNumber(annualExpenses, stored.withdrawal_rate);
      const progress_pct = fiNumber > 0 ? Math.min(100, (currentNetWorth / fiNumber) * 100) : 0;
      const monthsToFi = calcMonthsToFi(currentNetWorth, fiNumber, monthlySavings, stored.expected_return);
      const projectedFiDate =
        monthsToFi !== null
          ? addMonths(new Date(), monthsToFi).toISOString().slice(0, 10)
          : null;

      setProjection({
        fi_number: fiNumber,
        current_net_worth: currentNetWorth,
        progress_pct,
        monthly_savings: monthlySavings,
        annual_expenses: annualExpenses,
        months_to_fi: monthsToFi,
        projected_fi_date: projectedFiDate,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const updateAssumptions = useCallback(
    async (updates: Partial<FireAssumptions>) => {
      if (!user) return;
      const merged: FireAssumptions = {
        ...assumptions,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      await setDoc(doc(db, `users/${user.uid}/settings/fire`), merged);
      setAssumptions(merged);
      await load();
    },
    [user, assumptions, load]
  );

  return { projection, assumptions, updateAssumptions, loading, reload: load };
}

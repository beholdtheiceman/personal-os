"use client";
import { useEffect, useState, useCallback } from "react";
import { doc, collection, onSnapshot, setDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import type { BudgetMonth, BudgetCategory, Transaction } from "@/types";

const DEFAULT_THRESHOLD = 0.8;

export function useBudget(month?: string) {
  const { user } = useAuth();
  const currentMonth = month ?? format(new Date(), "yyyy-MM");

  const [budget, setBudget] = useState<BudgetMonth | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Listen to budget doc for the month
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "budgets", currentMonth);
    return onSnapshot(ref, (snap) => {
      setBudget(snap.exists() ? (snap.data() as BudgetMonth) : null);
      setLoading(false);
    });
  }, [user, currentMonth]);

  // Listen to transactions for the month
  useEffect(() => {
    if (!user) return;
    const start = `${currentMonth}-01`;
    const end = `${currentMonth}-31`;
    const q = query(
      collection(db, "users", user.uid, "transactions"),
      where("date", ">=", start),
      where("date", "<=", end)
    );
    return onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
    });
  }, [user, currentMonth]);

  // Compute actual spend per category (expenses only)
  const actuals = transactions
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    }, {});

  // All categories that either have a budget limit or have transactions
  const allCategories = Array.from(
    new Set([
      ...Object.keys(budget?.categories ?? {}),
      ...Object.keys(actuals),
    ])
  ).sort();

  const setLimit = useCallback(
    async (category: string, limit: number, alert_threshold = DEFAULT_THRESHOLD) => {
      if (!user || limit < 0) return;
      const ref = doc(db, "users", user.uid, "budgets", currentMonth);
      const existing = budget?.categories ?? {};
      await setDoc(
        ref,
        {
          categories: {
            ...existing,
            [category]: { limit, alert_threshold } satisfies BudgetCategory,
          },
          created_at: budget?.created_at ?? new Date().toISOString(),
        },
        { merge: true }
      );
    },
    [user, currentMonth, budget]
  );

  const removeLimit = useCallback(
    async (category: string) => {
      if (!user || !budget) return;
      const ref = doc(db, "users", user.uid, "budgets", currentMonth);
      const updated = { ...budget.categories };
      delete updated[category];
      await setDoc(ref, { categories: updated }, { merge: true });
    },
    [user, currentMonth, budget]
  );

  return {
    budget,
    actuals,
    allCategories,
    loading,
    currentMonth,
    setLimit,
    removeLimit,
  };
}

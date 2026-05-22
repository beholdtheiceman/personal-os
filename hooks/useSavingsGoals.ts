"use client";
import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { SavingsGoal, SavingsContribution } from "@/types";

export interface SavingsGoalComputed extends SavingsGoal {
  percent_complete: number;
  monthly_needed: number | null;   // null if target_date already passed
  projected_completion_date: string | null; // null if no contributions yet
}

function compute(goal: SavingsGoal): SavingsGoalComputed {
  const percent_complete = goal.target_amount > 0
    ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
    : 0;

  const today = new Date();
  const target = new Date(goal.target_date + "T00:00:00");
  const monthsLeft = Math.max(
    0,
    (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth())
  );
  const remaining = goal.target_amount - goal.current_amount;
  const monthly_needed = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : null;

  // Projected completion based on average monthly contribution rate
  let projected_completion_date: string | null = null;
  if (goal.contributions.length >= 2 && remaining > 0) {
    const sorted = [...goal.contributions].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(sorted[0].date + "T00:00:00");
    const totalMonths = Math.max(
      1,
      (today.getFullYear() - firstDate.getFullYear()) * 12 + (today.getMonth() - firstDate.getMonth())
    );
    const avgMonthly = goal.current_amount / totalMonths;
    if (avgMonthly > 0) {
      const monthsNeeded = remaining / avgMonthly;
      const projected = new Date(today);
      projected.setMonth(projected.getMonth() + Math.ceil(monthsNeeded));
      projected_completion_date = projected.toLocaleDateString("en-CA");
    }
  }

  return { ...goal, percent_complete, monthly_needed, projected_completion_date };
}

export function useSavingsGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<SavingsGoalComputed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/savings_goals`),
      orderBy("created_at", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setGoals(snap.docs.map((d) => compute({ id: d.id, ...d.data() } as SavingsGoal)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const addGoal = useCallback(
    async (data: Omit<SavingsGoal, "id" | "created_at" | "updated_at" | "contributions" | "current_amount">) => {
      if (!user) return;
      const now = new Date().toISOString();
      await addDoc(collection(db, `users/${user.uid}/savings_goals`), {
        ...data,
        current_amount: 0,
        contributions: [],
        created_at: now,
        updated_at: now,
      });
    },
    [user]
  );

  const logContribution = useCallback(
    async (goalId: string, contribution: SavingsContribution) => {
      if (!user) return;
      const goal = goals.find((g) => g.id === goalId);
      if (!goal) return;
      const newAmount = goal.current_amount + contribution.amount;
      const newStatus: SavingsGoal["status"] = newAmount >= goal.target_amount ? "completed" : goal.status;
      await updateDoc(doc(db, `users/${user.uid}/savings_goals/${goalId}`), {
        current_amount: newAmount,
        contributions: [...goal.contributions, contribution],
        status: newStatus,
        updated_at: new Date().toISOString(),
      });
    },
    [user, goals]
  );

  const updateGoal = useCallback(
    async (goalId: string, data: Partial<SavingsGoal>) => {
      if (!user) return;
      await updateDoc(doc(db, `users/${user.uid}/savings_goals/${goalId}`), {
        ...data,
        updated_at: new Date().toISOString(),
      });
    },
    [user]
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      if (!user) return;
      await deleteDoc(doc(db, `users/${user.uid}/savings_goals/${goalId}`));
    },
    [user]
  );

  const active    = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");

  return { goals, active, completed, loading, addGoal, logContribution, updateGoal, deleteGoal };
}

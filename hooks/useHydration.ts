"use client";
import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToday } from "@/hooks/useToday";
import { useXP } from "@/hooks/useXP";
import { awardXP } from "@/lib/awardXP";
import { checkAndAward } from "@/lib/checkAndAward";
import type { HydrationLog } from "@/types";

const DEFAULT_GOAL = 8;

export function useHydration() {
  const { user } = useAuth();
  const today = useToday();
  const { totalXP } = useXP();
  const [data, setData] = useState<HydrationLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "hydration", today);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setData(snap.data() as HydrationLog);
      } else {
        setData(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [user, today]);

  const increment = useCallback(async () => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "hydration", today);
    const current = data?.glasses ?? 0;
    const goal = data?.goal ?? DEFAULT_GOAL;
    const now = new Date().toISOString();

    if (!data) {
      await setDoc(ref, {
        date: today,
        glasses: 1,
        goal: DEFAULT_GOAL,
        logs: [now],
        updated_at: now,
      });
    } else {
      await updateDoc(ref, {
        glasses: current + 1,
        logs: arrayUnion(now),
        updated_at: now,
      });
    }

    // Award 10 XP exactly when the goal is first hit
    if (current + 1 === goal) {
      await awardXP(user.uid, 10, "hydration_goal", `Hydration goal hit: ${goal} glasses`, totalXP);
      await checkAndAward(user.uid, "full_tank");
    }
  }, [user, today, data, totalXP]);

  const setGoal = useCallback(async (newGoal: number) => {
    if (!user || newGoal < 1) return;
    const ref = doc(db, "users", user.uid, "hydration", today);
    const now = new Date().toISOString();
    if (!data) {
      await setDoc(ref, {
        date: today,
        glasses: 0,
        goal: newGoal,
        logs: [],
        updated_at: now,
      });
    } else {
      await updateDoc(ref, { goal: newGoal, updated_at: now });
    }
  }, [user, today, data]);

  return {
    glasses: data?.glasses ?? 0,
    goal: data?.goal ?? DEFAULT_GOAL,
    logs: data?.logs ?? [],
    loading,
    increment,
    setGoal,
  };
}

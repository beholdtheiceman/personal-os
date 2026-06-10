"use client";
import { useEffect, useState, useCallback } from "react";
import { doc, collection, onSnapshot, setDoc, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { awardXP } from "@/lib/awardXP";
import { useXP } from "@/hooks/useXP";
import type { EnergyEntry } from "@/types";

export function useEnergy() {
  const { user } = useAuth();
  const { totalXP } = useXP();
  const [today, setToday] = useState<EnergyEntry | null>(null);
  const [history, setHistory] = useState<EnergyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, `users/${user.uid}/energy/${todayStr}`);
    return onSnapshot(ref, (snap) => {
      setToday(snap.exists() ? ({ id: snap.id, ...snap.data() } as EnergyEntry) : null);
      setLoading(false);
    });
  }, [user, todayStr]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/energy`),
      orderBy("date", "desc"),
      limit(30),
    );
    return onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EnergyEntry)));
    });
  }, [user]);

  const logEnergy = useCallback(
    async (score: number, note?: string) => {
      if (!user) return;
      const isFirst = !today;
      await setDoc(doc(db, `users/${user.uid}/energy/${todayStr}`), {
        date: todayStr,
        score,
        note: note ?? "",
        logged_at: new Date().toISOString(),
      });
      if (isFirst) {
        await awardXP(user.uid, 5, "energy_logged", "Energy logged", totalXP);
      }
    },
    [user, todayStr, today, totalXP],
  );

  return { today, history, loading, logEnergy };
}

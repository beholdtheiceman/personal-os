"use client";
import { useEffect, useState, useCallback } from "react";
import { doc, collection, onSnapshot, setDoc, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { awardXP } from "@/lib/awardXP";
import { useXP } from "@/hooks/useXP";
import type { MoodEntry } from "@/types";

export function useMood() {
  const { user } = useAuth();
  const { totalXP } = useXP();
  const [today, setToday] = useState<MoodEntry | null>(null);
  const [history, setHistory] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toLocaleDateString("en-CA");

  // Today's entry
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, `users/${user.uid}/mood/${todayStr}`);
    const unsub = onSnapshot(ref, (snap) => {
      setToday(snap.exists() ? ({ id: snap.id, ...snap.data() } as MoodEntry) : null);
      setLoading(false);
    });
    return unsub;
  }, [user, todayStr]);

  // History (last 30 entries)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/mood`),
      orderBy("date", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MoodEntry)));
    });
    return unsub;
  }, [user]);

  const logMood = useCallback(
    async (score: number, note?: string) => {
      if (!user) return;
      const isFirst = !today;
      await setDoc(doc(db, `users/${user.uid}/mood/${todayStr}`), {
        date: todayStr,
        score,
        note: note ?? "",
        logged_at: new Date().toISOString(),
      });
      if (isFirst) {
        await awardXP(user.uid, 5, "mood_logged", "Mood logged", totalXP);
      }
    },
    [user, todayStr, today, totalXP]
  );

  return { today, history, loading, logMood };
}

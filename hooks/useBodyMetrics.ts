"use client";
import { useEffect, useState, useCallback } from "react";
import { doc, collection, onSnapshot, setDoc, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { BodyMetricsEntry } from "@/types";

export function useBodyMetrics() {
  const { user } = useAuth();
  const [today, setToday] = useState<BodyMetricsEntry | null>(null);
  const [history, setHistory] = useState<BodyMetricsEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toLocaleDateString("en-CA");

  // Today's entry
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, `users/${user.uid}/body_metrics/${todayStr}`);
    const unsub = onSnapshot(ref, (snap) => {
      setToday(snap.exists() ? ({ id: snap.id, ...snap.data() } as BodyMetricsEntry) : null);
      setLoading(false);
    });
    return unsub;
  }, [user, todayStr]);

  // History (last 60 entries for trend charts)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/body_metrics`),
      orderBy("date", "desc"),
      limit(60)
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BodyMetricsEntry)));
    });
    return unsub;
  }, [user]);

  const logMetrics = useCallback(
    async (data: Omit<BodyMetricsEntry, "id" | "date" | "logged_at">) => {
      if (!user) return;
      await setDoc(
        doc(db, `users/${user.uid}/body_metrics/${todayStr}`),
        { ...data, date: todayStr, logged_at: new Date().toISOString() },
        { merge: true }
      );
    },
    [user, todayStr]
  );

  // Derived: most recent value for each metric (for "current" display)
  const latest = history[0] ?? null;

  return { today, history, latest, loading, logMetrics };
}

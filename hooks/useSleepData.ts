"use client";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, orderBy, limit, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { HealthLog, HealthSettings } from "@/types";

const DEFAULT_TARGET = 8;

export function useSleepData(days = 30) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [targetHours, setTargetHoursState] = useState<number>(DEFAULT_TARGET);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/health`),
      orderBy("date", "desc"),
      limit(days),
    );
    return onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HealthLog)));
      setLoading(false);
    });
  }, [user, days]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, `users/${user.uid}/settings/health`), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<HealthSettings>;
        setTargetHoursState(data.target_sleep_hours ?? DEFAULT_TARGET);
      }
    });
  }, [user]);

  const setTargetHours = async (hours: number) => {
    if (!user) return;
    await setDoc(doc(db, `users/${user.uid}/settings/health`), { target_sleep_hours: hours }, { merge: true });
  };

  const logsWithSleep = logs.filter((l) => l.sleep_hours > 0);
  const last7 = logsWithSleep.slice(0, 7);
  const sleepDebt = last7.reduce((acc, l) => acc + Math.max(0, targetHours - l.sleep_hours), 0);
  const avgSleep = last7.length > 0
    ? last7.reduce((s, l) => s + l.sleep_hours, 0) / last7.length
    : null;

  return { logs: logsWithSleep, targetHours, setTargetHours, sleepDebt, avgSleep, loading };
}

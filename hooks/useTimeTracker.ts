"use client";
import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays } from "date-fns";
import type { TimeEntry, TimeCategory, TimeSource } from "@/types";

export function useTimeTracker() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "time_entries"),
      where("date", ">=", weekAgo),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeEntry));
      // Secondary sort by start_time desc, done client-side to avoid a composite index
      raw.sort((a, b) => {
        if (b.date !== a.date) return b.date.localeCompare(a.date);
        return b.start_time.localeCompare(a.start_time);
      });
      setEntries(raw);
      setLoading(false);
    });
  }, [user, weekAgo]);

  const todayEntries = entries.filter((e) => e.date === today);

  // Duration totals by category for the week
  const weeklyByCategory = entries.reduce<Record<TimeCategory, number>>(
    (acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.duration_min; return acc; },
    { work: 0, personal: 0, health: 0, learning: 0, other: 0 }
  );

  // Duration by date for the last 7 days
  const dailyTotals = entries.reduce<Record<string, number>>(
    (acc, e) => { acc[e.date] = (acc[e.date] ?? 0) + e.duration_min; return acc; },
    {}
  );

  const addEntry = useCallback(
    async (data: {
      description: string;
      duration_min: number;
      category: TimeCategory;
      source?: TimeSource;
      start_time?: string;
      end_time?: string;
      task_id?: string;
      project_id?: string;
      date?: string;
    }) => {
      if (!user) return;
      const now = new Date().toISOString();
      const entryDate = data.date ?? today;
      const end = data.end_time ?? now;
      const start = data.start_time ?? new Date(new Date(end).getTime() - data.duration_min * 60000).toISOString();
      await addDoc(collection(db, "users", user.uid, "time_entries"), {
        date: entryDate,
        start_time: start,
        end_time: end,
        duration_min: data.duration_min,
        description: data.description,
        task_id: data.task_id ?? null,
        project_id: data.project_id ?? null,
        category: data.category,
        source: data.source ?? "manual",
        created_at: now,
      });
    },
    [user, today]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, "users", user.uid, "time_entries", id));
    },
    [user]
  );

  return { entries, todayEntries, weeklyByCategory, dailyTotals, loading, addEntry, deleteEntry };
}

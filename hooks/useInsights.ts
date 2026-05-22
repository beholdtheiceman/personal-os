"use client";
import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, query, orderBy, limit, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getIdToken } from "firebase/auth";
import type { AIInsight } from "@/types";

export function useInsights() {
  const { user } = useAuth();
  const [latest,      setLatest]     = useState<AIInsight | null>(null);
  const [history,     setHistory]    = useState<AIInsight[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [generating,  setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/ai_insights`),
      orderBy("date", "desc"),
      limit(7)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AIInsight));
      setHistory(items);
      setLatest(items[0] ?? null);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const generate = useCallback(async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const token = await getIdToken(user);
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("[useInsights] generate error:", err);
    } finally {
      setGenerating(false);
    }
  }, [user]);

  // Check today's doc — today in user's local time
  const todayStr = new Date().toLocaleDateString("en-CA");
  const hasToday = latest?.date === todayStr;

  return { latest, history, loading, generating, hasToday, generate };
}

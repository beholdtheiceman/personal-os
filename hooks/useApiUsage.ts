"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface DayUsage {
  date: string;
  input_tokens: number;
  output_tokens: number;
  requests: number;
}

export interface ApiUsageSummary {
  today: DayUsage;
  month: { input_tokens: number; output_tokens: number; requests: number };
  last7Days: DayUsage[];
  /** Estimated cost in USD for the current month (Sonnet pricing) */
  estimatedCostUsd: number;
  loading: boolean;
}

// Claude Sonnet 4 pricing per 1M tokens
const PRICE_INPUT_PER_M  = 3.00;
const PRICE_OUTPUT_PER_M = 15.00;

export function useApiUsage(): ApiUsageSummary {
  const { user } = useAuth();
  const [days, setDays] = useState<DayUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Watch the last 35 days so we always cover a full month + week
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 34);
    const cutoffStr = cutoff.toLocaleDateString("en-CA"); // YYYY-MM-DD

    const q = query(
      collection(db, `users/${user.uid}/api_usage`),
      where("date", ">=", cutoffStr),
      orderBy("date", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setDays(snap.docs.map((d) => d.data() as DayUsage));
      setLoading(false);
    });

    return unsub;
  }, [user]);

  const todayStr = new Date().toLocaleDateString("en-CA");
  const monthPrefix = todayStr.slice(0, 7); // YYYY-MM

  const todayDoc = days.find((d) => d.date === todayStr) ?? {
    date: todayStr, input_tokens: 0, output_tokens: 0, requests: 0,
  };

  const monthDays = days.filter((d) => d.date.startsWith(monthPrefix));
  const month = monthDays.reduce(
    (acc, d) => ({
      input_tokens:  acc.input_tokens  + d.input_tokens,
      output_tokens: acc.output_tokens + d.output_tokens,
      requests:      acc.requests      + d.requests,
    }),
    { input_tokens: 0, output_tokens: 0, requests: 0 }
  );

  // Last 7 calendar days (for mini bar chart)
  const last7: DayUsage[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-CA");
    last7.push(days.find((r) => r.date === key) ?? { date: key, input_tokens: 0, output_tokens: 0, requests: 0 });
  }

  const estimatedCostUsd =
    (month.input_tokens  / 1_000_000) * PRICE_INPUT_PER_M +
    (month.output_tokens / 1_000_000) * PRICE_OUTPUT_PER_M;

  return { today: todayDoc, month, last7Days: last7, estimatedCostUsd, loading };
}

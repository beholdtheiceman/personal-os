"use client";
import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, doc, setDoc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { format, subMonths } from "date-fns";
import type { NetWorthSnapshot, AssetEntry, LiabilityEntry } from "@/types";

export function useNetWorth() {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "net_worth"),
      orderBy("snapshot_date", "asc")
    );
    return onSnapshot(q, (snap) => {
      setSnapshots(snap.docs.map((d) => d.data() as NetWorthSnapshot));
      setLoading(false);
    });
  }, [user]);

  const currentMonth = format(new Date(), "yyyy-MM");
  const current = snapshots.find((s) => s.snapshot_date === currentMonth) ?? null;

  // The most recent prior month's snapshot (for carry-forward)
  const prevMonth = format(subMonths(new Date(), 1), "yyyy-MM");
  const previous = snapshots.find((s) => s.snapshot_date === prevMonth) ?? null;

  const saveSnapshot = useCallback(
    async (
      assets: Record<string, AssetEntry>,
      liabilities: Record<string, LiabilityEntry>,
      month = currentMonth
    ) => {
      if (!user) return;
      const total_assets = Object.values(assets).reduce((s, a) => s + a.value, 0);
      const total_liabilities = Object.values(liabilities).reduce((s, l) => s + l.value, 0);
      const net_worth = total_assets - total_liabilities;
      const ref = doc(db, "users", user.uid, "net_worth", month);
      await setDoc(ref, {
        assets,
        liabilities,
        total_assets,
        total_liabilities,
        net_worth,
        snapshot_date: month,
        created_at: new Date().toISOString(),
      } satisfies NetWorthSnapshot);
    },
    [user, currentMonth]
  );

  return { snapshots, current, previous, loading, currentMonth, saveSnapshot };
}

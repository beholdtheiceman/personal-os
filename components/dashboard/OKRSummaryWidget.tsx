"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Objective, KeyResult } from "@/types";
import { RiLineChartLine } from "react-icons/ri";

function currentQuarter(): string {
  const now = new Date();
  return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
}

function krScore(kr: KeyResult): number {
  if (kr.target === 0) return kr.completed ? 1 : 0;
  return Math.min(1, kr.current / kr.target);
}

function objScore(obj: Objective): number {
  if (obj.review) return obj.review.score;
  if (obj.keyResults.length === 0) return 0;
  return obj.keyResults.reduce((s, kr) => s + krScore(kr), 0) / obj.keyResults.length;
}

export default function OKRSummaryWidget() {
  const { user } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const quarter = currentQuarter();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/okrs`), orderBy("created_at", "desc"));
    return onSnapshot(q, (snap) => {
      setObjectives(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Objective)));
      setLoading(false);
    });
  }, [user]);

  if (loading) return null;
  const current = objectives.filter((o) => o.quarter === quarter && o.status === "active");
  if (current.length === 0) return null;

  const avgScore = current.reduce((s, o) => s + objScore(o), 0) / current.length;
  const pct = Math.round(avgScore * 100);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
          <RiLineChartLine className="w-3.5 h-3.5" /> {quarter} OKRs
        </h2>
        <a href="/okrs" className="text-xs text-accent hover:text-accent-text">View all</a>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className={`text-2xl font-bold ${pct >= 70 ? "text-success" : pct >= 40 ? "text-amber-400" : "text-accent"}`}>
          {pct}%
        </span>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct >= 70 ? "bg-success" : pct >= 40 ? "bg-amber-400" : "bg-accent"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-text-muted mt-0.5">{current.length} objective{current.length > 1 ? "s" : ""}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {current.slice(0, 3).map((obj) => {
          const s = Math.round(objScore(obj) * 100);
          const krDone = obj.keyResults.filter((kr) => kr.completed).length;
          return (
            <div key={obj.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-primary truncate">{obj.title}</p>
                <p className="text-xs text-text-muted">{krDone}/{obj.keyResults.length} KRs</p>
              </div>
              <span className={`text-xs font-medium shrink-0 ${s >= 70 ? "text-success" : s >= 40 ? "text-amber-400" : "text-text-muted"}`}>
                {s}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

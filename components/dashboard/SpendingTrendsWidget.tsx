"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuth } from "firebase/auth";
import { RiLineChartLine } from "react-icons/ri";
import Link from "next/link";
import type { CategoryTrend } from "@/lib/spending-trends";

export default function SpendingTrendsWidget() {
  const { user } = useAuth();
  const [trends, setTrends] = useState<CategoryTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await getAuth().currentUser?.getIdToken();
        const res = await fetch("/api/finance/trends", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setTrends(data.trends ?? []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const atRisk = trends.filter((t) => t.overspendAmount > 0);

  return (
    <div
      className="rounded-2xl p-4 border border-white/10"
      style={{ background: "rgba(10, 4, 16, 0.82)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiLineChartLine className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Spending Trends
          </span>
        </div>
        <Link href="/finance?tab=budget" className="text-xs text-accent hover:text-accent/80 transition-colors">
          View Budget
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-1">
          <div className="w-3 h-3 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
          <span className="text-xs text-text-muted">Loading...</span>
        </div>
      ) : atRisk.length === 0 ? (
        <p className="text-sm text-green-400 font-medium">All budgets on track</p>
      ) : (
        <div className="space-y-3">
          {atRisk.slice(0, 4).map((t) => {
            const barPct = Math.min(100, t.percentUsed * 100);
            return (
              <div key={t.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-text-primary">{t.category}</span>
                  <span className="text-xs font-semibold text-red-400">
                    +${Math.round(t.overspendAmount)} over
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-400/70 transition-all"
                    style={{ width: `${Math.min(barPct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px] text-text-muted">${t.spent.toFixed(0)} spent</span>
                  <span className="text-[10px] text-text-muted">${t.limit} limit</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

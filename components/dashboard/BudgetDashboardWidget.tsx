"use client";
import { RiMoneyDollarCircleLine } from "react-icons/ri";
import { useBudget } from "@/hooks/useBudget";
import Link from "next/link";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function BudgetDashboardWidget() {
  const { budget, actuals, loading } = useBudget();

  if (loading) return null;

  const categories = Object.entries(budget?.categories ?? {});
  if (categories.length === 0) return null;

  const alerts = categories
    .map(([cat, entry]) => {
      const spent = actuals[cat] ?? 0;
      const pct = entry.limit > 0 ? spent / entry.limit : 0;
      return { cat, spent, limit: entry.limit, pct, over: spent > entry.limit, near: pct >= entry.alert_threshold && spent <= entry.limit };
    })
    .filter((c) => c.over || c.near)
    .sort((a, b) => b.pct - a.pct);

  const totalBudgeted = categories.reduce((s, [, e]) => s + e.limit, 0);
  const totalSpent = Object.values(actuals).reduce((s, v) => s + v, 0);
  const overallPct = totalBudgeted > 0 ? Math.min(totalSpent / totalBudgeted, 1) : 0;
  const overallOver = totalSpent > totalBudgeted;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiMoneyDollarCircleLine className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-text-primary">Budget</h3>
        </div>
        <Link href="/finance" className="text-xs text-text-muted hover:text-accent transition-colors">Manage</Link>
      </div>

      {/* Overall progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">Overall</span>
          <span className={overallOver ? "text-red-400 font-medium" : "text-text-secondary"}>
            {fmt(totalSpent)} / {fmt(totalBudgeted)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${overallOver ? "bg-red-500" : overallPct >= 0.8 ? "bg-amber-400" : "bg-success"}`}
            style={{ width: `${overallPct * 100}%` }}
          />
        </div>
      </div>

      {/* Alert categories */}
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.slice(0, 3).map(({ cat, spent, limit, over }) => (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${over ? "bg-red-500" : "bg-amber-400"}`} />
              <span className="text-text-secondary capitalize flex-1 truncate">{cat}</span>
              <span className={over ? "text-red-400" : "text-amber-400"}>{fmt(spent)} / {fmt(limit)}</span>
            </div>
          ))}
        </div>
      )}

      {alerts.length === 0 && (
        <p className="text-xs text-text-muted">All categories on track</p>
      )}
    </div>
  );
}

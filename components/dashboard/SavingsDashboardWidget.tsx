"use client";
import Link from "next/link";
import { RiSaveLine } from "react-icons/ri";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";

export default function SavingsDashboardWidget() {
  const { active, loading } = useSavingsGoals();

  if (loading || active.length === 0) return null;

  const totalSaved  = active.reduce((s, g) => s + g.current_amount, 0);
  const totalTarget = active.reduce((s, g) => s + g.target_amount, 0);
  const overallPct  = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;

  const fmt = (n: number) =>
    n >= 1000
      ? `$${(n / 1000).toFixed(1)}k`
      : `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiSaveLine className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text-primary">Savings</span>
        </div>
        <Link href="/finance" className="text-xs text-text-muted hover:text-accent transition-colors">
          View →
        </Link>
      </div>

      {/* Overall summary */}
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-lg font-bold text-text-primary">{fmt(totalSaved)}</span>
        <span className="text-xs text-text-muted">/ {fmt(totalTarget)}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${overallPct}%` }} />
      </div>

      {/* Individual goals */}
      <div className="space-y-2">
        {active.slice(0, 3).map((goal) => (
          <div key={goal.id} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: goal.color ?? "#C4728A" }} />
            <span className="text-xs text-text-secondary truncate flex-1">{goal.name}</span>
            <span className="text-xs text-text-muted shrink-0">{goal.percent_complete.toFixed(0)}%</span>
          </div>
        ))}
        {active.length > 3 && (
          <p className="text-xs text-text-muted">+{active.length - 3} more</p>
        )}
      </div>
    </div>
  );
}

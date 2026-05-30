"use client";
import { useMemo } from "react";
import Link from "next/link";
import { RiMoneyDollarCircleLine, RiArrowRightLine } from "react-icons/ri";
import { useDebts } from "@/hooks/useDebts";
import { calculatePayoff } from "@/lib/debt-calculator";

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function DebtPayoffWidget() {
  const { debts, loading } = useDebts();

  const plan = useMemo(() => calculatePayoff(debts, "snowball", 0), [debts]);

  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);

  // First debt to pay off in snowball order
  const nextDebt = useMemo(() => {
    if (plan.debts.length === 0) return null;
    const first = plan.debts.find((d) => d.payment_order === 1);
    if (!first) return null;
    const debt = debts.find((d) => d.id === first.id);
    return debt ? { ...debt, payoff_date: first.payoff_date } : null;
  }, [plan, debts]);

  if (loading) {
    return (
      <div className="card space-y-3 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-32" />
        <div className="h-8 bg-white/10 rounded w-24" />
        <div className="h-2 bg-white/10 rounded" />
      </div>
    );
  }

  if (debts.length === 0) {
    return (
      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
            <RiMoneyDollarCircleLine className="w-4 h-4 text-accent" /> Debt Payoff
          </h3>
          <Link href="/finance?tab=debt" className="text-xs text-accent hover:underline flex items-center gap-1">
            View Planner <RiArrowRightLine className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-xs text-text-muted py-2">No debts tracked yet.</p>
      </div>
    );
  }

  const nextPct = nextDebt?.original_balance && nextDebt.original_balance > 0
    ? Math.min(100, ((nextDebt.original_balance - nextDebt.balance) / nextDebt.original_balance) * 100)
    : null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
          <RiMoneyDollarCircleLine className="w-4 h-4 text-accent" /> Debt Payoff
        </h3>
        <Link href="/finance?tab=debt" className="text-xs text-accent hover:underline flex items-center gap-1">
          View Planner <RiArrowRightLine className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-text-primary">{fmt(totalBalance)}</span>
        <span className="text-xs text-text-muted">total debt</span>
      </div>

      {nextDebt && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary font-medium truncate">{nextDebt.name}</span>
            <span className="text-text-muted ml-2 shrink-0">{fmt(nextDebt.balance)}</span>
          </div>
          {nextPct !== null ? (
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${nextPct}%` }} />
            </div>
          ) : (
            <div className="h-1.5 bg-white/10 rounded-full" />
          )}
          <p className="text-xs text-text-muted">Payoff: {nextDebt.payoff_date}</p>
        </div>
      )}

      {plan.payoff_date && (
        <p className="text-xs text-green-400 font-medium">
          Debt-free by {plan.payoff_date}
        </p>
      )}
    </div>
  );
}

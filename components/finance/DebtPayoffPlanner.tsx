"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  RiMoneyDollarCircleLine, RiAddLine, RiEditLine, RiDeleteBinLine,
  RiCheckLine, RiArrowDownLine, RiArrowUpLine,
} from "react-icons/ri";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useDebts } from "@/hooks/useDebts";
import { calculatePayoff, formatPayoffDuration } from "@/lib/debt-calculator";
import type { Debt, DebtType } from "@/types";
import toast from "react-hot-toast";

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card:   "Credit Card",
  auto_loan:     "Auto Loan",
  student_loan:  "Student Loan",
  personal_loan: "Personal Loan",
  mortgage:      "Mortgage",
  medical:       "Medical",
  other:         "Other",
};

const TYPE_COLORS: Record<DebtType, string> = {
  credit_card:   "#E06B5D",
  auto_loan:     "#E8A838",
  student_loan:  "#7C9EBF",
  personal_loan: "#A07CC0",
  mortgage:      "#82C99A",
  medical:       "#C4728A",
  other:         "#8899AA",
};

const fmt = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtPct = (n: number) =>
  (n * 100).toFixed(2) + "%";

// ─── Debt Form ────────────────────────────────────────────────────────────────
function DebtForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Debt>;
  onSave: (data: Omit<Debt, "id" | "created_at" | "updated_at">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName]       = useState(initial?.name ?? "");
  const [type, setType]       = useState<DebtType>(initial?.type ?? "credit_card");
  const [balance, setBalance] = useState(String(initial?.balance ?? ""));
  const [apr, setApr]         = useState(initial?.interest_rate != null ? String(initial.interest_rate * 100) : "");
  const [minPay, setMinPay]   = useState(String(initial?.minimum_payment ?? ""));
  const [origBal, setOrigBal] = useState(initial?.original_balance != null ? String(initial.original_balance) : "");
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async () => {
    if (!name || !balance || !apr || !minPay) return toast.error("Fill in all required fields");
    const b = parseFloat(balance);
    const r = parseFloat(apr) / 100;
    const m = parseFloat(minPay);
    if (isNaN(b) || isNaN(r) || isNaN(m)) return toast.error("Invalid number");
    setSaving(true);
    await onSave({
      name, type,
      balance: b,
      interest_rate: r,
      minimum_payment: m,
      ...(origBal ? { original_balance: parseFloat(origBal) } : {}),
    });
    setSaving(false);
  };

  return (
    <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-muted mb-1 block">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Chase Sapphire" className="input-base text-sm" />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Type *</label>
          <select value={type} onChange={(e) => setType(e.target.value as DebtType)} className="input-base text-sm">
            {(Object.keys(DEBT_TYPE_LABELS) as DebtType[]).map((t) => (
              <option key={t} value={t}>{DEBT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Current balance ($) *</label>
          <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="5000" className="input-base text-sm" />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">APR (%) *</label>
          <input type="number" step="0.01" value={apr} onChange={(e) => setApr(e.target.value)} placeholder="23.99" className="input-base text-sm" />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Minimum payment ($) *</label>
          <input type="number" value={minPay} onChange={(e) => setMinPay(e.target.value)} placeholder="150" className="input-base text-sm" />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Original balance ($) <span className="opacity-50">optional</span></label>
          <input type="number" value={origBal} onChange={(e) => setOrigBal(e.target.value)} placeholder="6000" className="input-base text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm py-1.5 flex items-center gap-1.5">
          <RiCheckLine className="w-4 h-4" />
          {saving ? "Saving..." : initial?.name ? "Update" : "Add Debt"}
        </button>
        <button onClick={onCancel} className="btn-ghost text-sm py-1.5">Cancel</button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DebtPayoffPlanner() {
  const { user } = useAuth();
  const { debts, loading, addDebt, updateDebt, deleteDebt } = useDebts();
  const [showForm, setShowForm]     = useState(false);
  const [editDebt, setEditDebt]     = useState<Debt | null>(null);
  const [method, setMethod]         = useState<"avalanche" | "snowball" | "custom">("avalanche");
  const [extra, setExtra]           = useState(0);
  const [customOrder, setCustomOrder] = useState<string[]>([]);

  // Load saved custom order from Firestore
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid, "settings", "debt_payoff")).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.custom_order)) setCustomOrder(data.custom_order);
      }
    });
  }, [user]);

  // Persist custom order
  const saveCustomOrder = useCallback(async (order: string[]) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid, "settings", "debt_payoff"), {
      custom_order: order,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  }, [user]);

  // Sorted debts based on active method
  const sortedDebts = useMemo(() => {
    if (method === "custom") {
      const orderMap = new Map(customOrder.map((id, i) => [id, i]));
      return [...debts].sort((a, b) => {
        const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
        const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
        return ai - bi;
      });
    }
    return debts; // calculatePayoff handles avalanche/snowball sorting internally
  }, [debts, method, customOrder]);

  const moveDebt = useCallback((id: string, direction: "up" | "down") => {
    const current = sortedDebts.map((d) => d.id);
    const idx = current.indexOf(id);
    if (idx === -1) return;
    const newOrder = [...current];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    setCustomOrder(newOrder);
    saveCustomOrder(newOrder);
  }, [sortedDebts, saveCustomOrder]);

  const plan = useMemo(
    () => method === "custom"
      ? calculatePayoff(sortedDebts, "avalanche", extra) // custom order, avalanche math
      : calculatePayoff(debts, method, extra),
    [debts, sortedDebts, method, extra]
  );

  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);

  const payoffMonths = useMemo(() => {
    if (!plan.payoff_date) return 0;
    const ms = new Date(plan.payoff_date).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24 * 30)));
  }, [plan.payoff_date]);

  if (loading) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <RiMoneyDollarCircleLine className="w-4 h-4 text-accent" /> Debt Payoff Planner
        </h2>
        <button onClick={() => { setShowForm(true); setEditDebt(null); }} className="btn-ghost text-xs py-1 px-2 flex items-center gap-1">
          <RiAddLine className="w-3.5 h-3.5" /> Add Debt
        </button>
      </div>

      {/* Add form */}
      {showForm && !editDebt && (
        <DebtForm
          onSave={async (data) => { await addDebt(data); setShowForm(false); toast.success("Debt added"); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Edit form */}
      {editDebt && (
        <DebtForm
          initial={editDebt}
          onSave={async (data) => { await updateDebt(editDebt.id, data); setEditDebt(null); toast.success("Debt updated"); }}
          onCancel={() => setEditDebt(null)}
        />
      )}

      {/* Empty state */}
      {debts.length === 0 && !showForm && (
        <p className="text-sm text-text-muted text-center py-6">No debts added yet. Add one to start planning your payoff.</p>
      )}

      {/* Debt cards */}
      {debts.length > 0 && (
        <div className="space-y-3">
          {sortedDebts.map((debt, idx) => {
            const pct = debt.original_balance && debt.original_balance > 0
              ? Math.min(100, ((debt.original_balance - debt.balance) / debt.original_balance) * 100)
              : null;
            const color = TYPE_COLORS[debt.type];
            return (
              <div key={debt.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-text-primary">{debt.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full border border-white/10" style={{ color, background: color + "22" }}>
                        {DEBT_TYPE_LABELS[debt.type]}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      APR {fmtPct(debt.interest_rate)} &middot; min {fmt(debt.minimum_payment)}/mo
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-semibold text-text-primary">{fmt(debt.balance)}</span>
                    {method === "custom" && (
                      <>
                        <button onClick={() => moveDebt(debt.id, "up")} disabled={idx === 0} className="btn-ghost p-1 disabled:opacity-30" title="Move up">
                          <RiArrowUpLine className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => moveDebt(debt.id, "down")} disabled={idx === sortedDebts.length - 1} className="btn-ghost p-1 disabled:opacity-30" title="Move down">
                          <RiArrowDownLine className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    <button onClick={() => { setEditDebt(debt); setShowForm(false); }} className="btn-ghost p-1.5 ml-1">
                      <RiEditLine className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm("Delete this debt?")) { deleteDebt(debt.id); toast.success("Deleted"); } }}
                      className="btn-ghost p-1.5 hover:text-danger"
                    >
                      <RiDeleteBinLine className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {pct !== null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-text-muted">
                      <span>{pct.toFixed(0)}% paid off</span>
                      <span>Started at {fmt(debt.original_balance!)}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Payoff calculator */}
      {debts.length > 0 && (
        <div className="space-y-4 pt-2 border-t border-white/10">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Payoff Calculator</h3>

          {/* Method toggle */}
          <div className="space-y-2">
            <div className="flex gap-2">
              {(["avalanche", "snowball", "custom"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    method === m
                      ? "bg-accent/20 border-accent/40 text-white"
                      : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10"
                  }`}
                >
                  {m === "avalanche" ? "Avalanche" : m === "snowball" ? "Snowball" : "Custom"}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              {method === "avalanche"
                ? "Avalanche: pay minimums on all, throw extra at the highest interest rate first. Minimizes total interest paid."
                : method === "snowball"
                ? "Snowball: pay minimums on all, throw extra at the smallest balance first. Builds momentum with quick wins."
                : "Custom: use the ↑↓ arrows on each debt to set your own payoff order. Your order is saved automatically."}
            </p>
          </div>

          {/* Extra payment input */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">Extra monthly payment ($)</label>
            <input
              type="number"
              value={extra || ""}
              onChange={(e) => setExtra(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0"
              className="input-base text-sm w-40"
            />
            <p className="text-xs text-text-muted mt-1">See how extra payments accelerate your payoff date</p>
          </div>

          {/* Results summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-xs text-text-muted">Total debt</p>
              <p className="text-base font-semibold text-text-primary mt-0.5">{fmt(totalBalance)}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-xs text-text-muted">Monthly payment</p>
              <p className="text-base font-semibold text-text-primary mt-0.5">{fmt(plan.monthly_payment)}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-xs text-text-muted">Total interest</p>
              <p className="text-base font-semibold text-red-400 mt-0.5">{fmt(plan.total_interest)}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10">
              <p className="text-xs text-text-muted">Debt-free date</p>
              <p className="text-base font-semibold text-green-400 mt-0.5">{plan.payoff_date}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 col-span-2 sm:col-span-2">
              <p className="text-xs text-text-muted">Time to payoff</p>
              <p className="text-base font-semibold text-text-primary mt-0.5">{formatPayoffDuration(payoffMonths)}</p>
            </div>
          </div>

          {/* Per-debt payoff order */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Payoff Order</h4>
            <div className="space-y-2">
              {plan.debts.map((pd) => (
                <div key={pd.id} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center shrink-0 font-medium">
                      {pd.payment_order}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary truncate">{pd.name}</p>
                      <p className="text-xs text-text-muted">Interest: {fmt(pd.total_interest)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-text-secondary font-medium">{pd.payoff_date}</p>
                    <RiArrowDownLine className="w-3 h-3 text-green-400 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

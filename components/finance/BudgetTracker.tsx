"use client";
import { useState } from "react";
import { RiEditLine, RiCheckLine, RiCloseLine, RiAddLine } from "react-icons/ri";
import { useBudget } from "@/hooks/useBudget";
import { format, subMonths } from "date-fns";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function ProgressBar({ spent, limit, threshold }: { spent: number; limit: number; threshold: number }) {
  const pct = limit > 0 ? Math.min(spent / limit, 1) : 0;
  const over = spent > limit && limit > 0;
  const near = !over && pct >= threshold && limit > 0;
  const color = over ? "bg-red-500" : near ? "bg-amber-400" : "bg-success";

  return (
    <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

interface EditRowProps {
  category: string;
  currentLimit: number;
  onSave: (limit: number) => void;
  onCancel: () => void;
}

function EditRow({ category, currentLimit, onSave, onCancel }: EditRowProps) {
  const [val, setVal] = useState(String(currentLimit || ""));
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-primary flex-1">{category}</span>
      <span className="text-xs text-text-muted">$</span>
      <input
        type="number"
        min={0}
        className="input-base w-24 text-xs py-1 px-2"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { const n = parseFloat(val); if (!isNaN(n) && n >= 0) onSave(n); }
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <button onClick={() => { const n = parseFloat(val); if (!isNaN(n) && n >= 0) onSave(n); }} className="text-success hover:opacity-80">
        <RiCheckLine className="w-4 h-4" />
      </button>
      <button onClick={onCancel} className="text-text-muted hover:text-text-secondary">
        <RiCloseLine className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function BudgetTracker() {
  const [viewMonth, setViewMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const { budget, actuals, allCategories, loading, setLimit } = useBudget(viewMonth);
  const [editing, setEditing] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newLimit, setNewLimit] = useState("");

  if (loading) return <div className="py-8 text-center text-text-muted text-sm">Loading…</div>;

  const handleSave = async (category: string, limit: number) => {
    await setLimit(category, limit);
    setEditing(null);
  };

  const handleAddNew = async () => {
    const cat = newCategory.trim();
    const lim = parseFloat(newLimit);
    if (!cat || isNaN(lim) || lim < 0) return;
    await setLimit(cat, lim);
    setNewCategory("");
    setNewLimit("");
    setAddingNew(false);
  };

  const prev = format(subMonths(new Date(viewMonth + "-01"), 1), "yyyy-MM");
  const next = format(new Date(viewMonth + "-01"), "yyyy-MM") < format(new Date(), "yyyy-MM")
    ? format(new Date(new Date(viewMonth + "-01").setMonth(new Date(viewMonth + "-01").getMonth() + 1)), "yyyy-MM")
    : null;

  const totalBudgeted = Object.values(budget?.categories ?? {}).reduce((s, c) => s + c.limit, 0);
  const totalSpent = Object.values(actuals).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setViewMonth(prev)} className="text-xs text-text-muted hover:text-text-secondary px-2 py-1">← {prev}</button>
        <span className="text-sm font-semibold text-text-primary">{format(new Date(viewMonth + "-01"), "MMMM yyyy")}</span>
        {next ? (
          <button onClick={() => setViewMonth(next)} className="text-xs text-text-muted hover:text-text-secondary px-2 py-1">{next} →</button>
        ) : <span className="w-20" />}
      </div>

      {/* Summary */}
      {totalBudgeted > 0 && (
        <div className="flex gap-6 text-sm border-b border-bg-border pb-3">
          <div>
            <span className="text-text-muted text-xs">Spent </span>
            <span className={`font-semibold ${totalSpent > totalBudgeted ? "text-red-400" : "text-text-primary"}`}>{fmt(totalSpent)}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs">Budgeted </span>
            <span className="font-semibold text-text-primary">{fmt(totalBudgeted)}</span>
          </div>
          <div>
            <span className="text-text-muted text-xs">Remaining </span>
            <span className={`font-semibold ${totalBudgeted - totalSpent < 0 ? "text-red-400" : "text-success"}`}>
              {fmt(Math.max(0, totalBudgeted - totalSpent))}
            </span>
          </div>
        </div>
      )}

      {/* Category rows */}
      <div className="space-y-3">
        {allCategories.map((cat) => {
          const spent = actuals[cat] ?? 0;
          const budgetEntry = budget?.categories[cat];
          const limit = budgetEntry?.limit ?? 0;
          const threshold = budgetEntry?.alert_threshold ?? 0.8;
          const pct = limit > 0 ? spent / limit : null;
          const over = limit > 0 && spent > limit;
          const near = limit > 0 && !over && pct !== null && pct >= threshold;

          if (editing === cat) {
            return (
              <div key={cat} className="space-y-1">
                <EditRow
                  category={cat}
                  currentLimit={limit}
                  onSave={(l) => handleSave(cat, l)}
                  onCancel={() => setEditing(null)}
                />
              </div>
            );
          }

          return (
            <div key={cat} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-primary flex-1 capitalize">{cat}</span>
                <span className={`text-xs font-medium ${over ? "text-red-400" : near ? "text-amber-400" : "text-text-secondary"}`}>
                  {fmt(spent)}{limit > 0 ? ` / ${fmt(limit)}` : ""}
                </span>
                {over && <span className="text-[10px] font-semibold text-red-400 uppercase">Over</span>}
                {near && !over && <span className="text-[10px] font-semibold text-amber-400 uppercase">Near</span>}
                <button onClick={() => setEditing(cat)} className="text-text-muted hover:text-text-secondary">
                  <RiEditLine className="w-3.5 h-3.5" />
                </button>
              </div>
              {limit > 0 && <ProgressBar spent={spent} limit={limit} threshold={threshold} />}
              {limit === 0 && (
                <p className="text-[10px] text-text-muted italic">No budget set — <button onClick={() => setEditing(cat)} className="text-accent hover:underline">set limit</button></p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new category */}
      {addingNew ? (
        <div className="flex items-center gap-2 pt-2 border-t border-bg-border">
          <input
            type="text"
            placeholder="Category name"
            className="input-base flex-1 text-xs py-1 px-2"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddNew(); if (e.key === "Escape") setAddingNew(false); }}
            autoFocus
          />
          <span className="text-xs text-text-muted">$</span>
          <input
            type="number"
            min={0}
            placeholder="Limit"
            className="input-base w-24 text-xs py-1 px-2"
            value={newLimit}
            onChange={(e) => setNewLimit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddNew(); if (e.key === "Escape") setAddingNew(false); }}
          />
          <button onClick={handleAddNew} className="text-success hover:opacity-80"><RiCheckLine className="w-4 h-4" /></button>
          <button onClick={() => setAddingNew(false)} className="text-text-muted hover:text-text-secondary"><RiCloseLine className="w-4 h-4" /></button>
        </div>
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-text pt-2 border-t border-bg-border w-full"
        >
          <RiAddLine className="w-3.5 h-3.5" /> Add budget category
        </button>
      )}
    </div>
  );
}

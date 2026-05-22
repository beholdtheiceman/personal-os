"use client";
import { useState } from "react";
import { RiSaveLine, RiAddLine, RiEditLine, RiDeleteBinLine, RiCheckLine, RiCloseLine } from "react-icons/ri";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import type { SavingsGoal } from "@/types";
import toast from "react-hot-toast";

const COLORS = ["#C4728A", "#7C9EBF", "#82C99A", "#E8A838", "#A07CC0", "#E06B5D"];

function GoalForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<SavingsGoal>;
  onSave: (data: Omit<SavingsGoal, "id" | "created_at" | "updated_at" | "contributions" | "current_amount">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName]       = useState(initial?.name ?? "");
  const [target, setTarget]   = useState(String(initial?.target_amount ?? ""));
  const [date, setDate]       = useState(initial?.target_date ?? "");
  const [color, setColor]     = useState(initial?.color ?? COLORS[0]);
  const [saving, setSaving]   = useState(false);

  const handleSubmit = async () => {
    if (!name || !target || !date) return toast.error("Fill in all required fields");
    setSaving(true);
    await onSave({ name, target_amount: parseFloat(target), target_date: date, color, status: "active" });
    setSaving(false);
  };

  return (
    <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-muted mb-1 block">Goal name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency Fund" className="input-base text-sm" />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Target amount *</label>
          <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10000" className="input-base text-sm" />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Target date *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-base text-sm" />
        </div>
        <div>
          <label className="text-xs text-text-muted mb-1 block">Color</label>
          <div className="flex gap-2 mt-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? "border-white scale-110" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm py-1.5 flex items-center gap-1.5">
          <RiCheckLine className="w-4 h-4" />
          {saving ? "Saving..." : initial?.name ? "Update" : "Create Goal"}
        </button>
        <button onClick={onCancel} className="btn-ghost text-sm py-1.5">Cancel</button>
      </div>
    </div>
  );
}

function ContributeModal({
  goalName,
  onSave,
  onCancel,
}: {
  goalName: string;
  onSave: (amount: number, note: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote]     = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    await onSave(n, note);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Add Contribution</h3>
          <button onClick={onCancel} className="btn-ghost p-1"><RiCloseLine className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-text-muted">Contributing to: <span className="text-text-secondary">{goalName}</span></p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Amount ($) *</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" className="input-base text-sm" autoFocus />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Paycheck savings..." className="input-base text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-1.5 flex items-center gap-1.5">
            <RiCheckLine className="w-4 h-4" />
            {saving ? "Saving..." : "Add"}
          </button>
          <button onClick={onCancel} className="btn-ghost text-sm py-1.5">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function SavingsGoals() {
  const { goals, loading, addGoal, logContribution, updateGoal, deleteGoal } = useSavingsGoals();
  const [showForm, setShowForm]         = useState(false);
  const [editGoal, setEditGoal]         = useState<SavingsGoal | null>(null);
  const [contributeGoal, setContribute] = useState<SavingsGoal | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  if (loading) return null;

  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <RiSaveLine className="w-4 h-4 text-accent" /> Savings Goals
        </h2>
        <button onClick={() => setShowForm(true)} className="btn-ghost text-xs py-1 px-2 flex items-center gap-1">
          <RiAddLine className="w-3.5 h-3.5" /> New Goal
        </button>
      </div>

      {showForm && (
        <GoalForm
          onSave={async (data) => { await addGoal(data); setShowForm(false); toast.success("Goal created"); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editGoal && (
        <GoalForm
          initial={editGoal}
          onSave={async (data) => { await updateGoal(editGoal.id, data); setEditGoal(null); toast.success("Goal updated"); }}
          onCancel={() => setEditGoal(null)}
        />
      )}

      {goals.length === 0 && !showForm && (
        <p className="text-sm text-text-muted text-center py-6">No savings goals yet. Create one to get started.</p>
      )}

      <div className="space-y-3">
        {goals.map((goal) => {
          const expanded = expandedId === goal.id;
          return (
            <div key={goal.id} className="card space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: goal.color ?? COLORS[0] }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{goal.name}</p>
                    <p className="text-xs text-text-muted">Target: {fmt(goal.target_amount)} by {goal.target_date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {goal.status === "active" && (
                    <button
                      onClick={() => setContribute(goal)}
                      className="text-xs bg-accent/10 text-accent hover:bg-accent/20 px-2 py-1 rounded-lg transition-colors"
                    >
                      + Add
                    </button>
                  )}
                  <button onClick={() => setEditGoal(goal)} className="btn-ghost p-1.5"><RiEditLine className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { if (confirm("Delete this goal?")) { deleteGoal(goal.id); toast.success("Deleted"); } }} className="btn-ghost p-1.5 hover:text-danger">
                    <RiDeleteBinLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary font-medium">{fmt(goal.current_amount)} saved</span>
                  <span className="text-text-muted">{goal.percent_complete.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${goal.percent_complete}%`, background: goal.color ?? COLORS[0] }}
                  />
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  {goal.monthly_needed != null && goal.status === "active" && (
                    <span>{fmt(goal.monthly_needed)}/mo needed</span>
                  )}
                  {goal.projected_completion_date && (
                    <span>Projected: {goal.projected_completion_date}</span>
                  )}
                  {goal.status === "completed" && (
                    <span className="text-success font-medium">Goal reached!</span>
                  )}
                </div>
              </div>

              {/* Contribution history */}
              {goal.contributions.length > 0 && (
                <div>
                  <button
                    onClick={() => setExpandedId(expanded ? null : goal.id)}
                    className="text-xs text-text-muted hover:text-text-secondary"
                  >
                    {expanded ? "Hide" : "Show"} history ({goal.contributions.length} contributions)
                  </button>
                  {expanded && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {[...goal.contributions].sort((a, b) => b.date.localeCompare(a.date)).map((c, i) => (
                        <div key={i} className="flex justify-between text-xs py-0.5 border-b border-white/5 last:border-0">
                          <span className="text-text-muted">{c.date}{c.note ? ` — ${c.note}` : ""}</span>
                          <span className="text-success font-medium">+{fmt(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {contributeGoal && (
        <ContributeModal
          goalName={contributeGoal.name}
          onSave={async (amount, note) => {
            await logContribution(contributeGoal.id, { amount, note, date: new Date().toLocaleDateString("en-CA") });
            toast.success(`${fmt(amount)} added to ${contributeGoal.name}`);
            setContribute(null);
          }}
          onCancel={() => setContribute(null)}
        />
      )}
    </div>
  );
}

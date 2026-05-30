"use client";
import { useState } from "react";
import { RiFireLine, RiEditLine, RiRefreshLine, RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import toast from "react-hot-toast";
import { useFireProjection } from "@/hooks/useFireProjection";
import { calcMonthsToFi, formatTimeToFi } from "@/lib/fire-calculator";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number) {
  return n.toFixed(1) + "%";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-white/10 rounded w-1/3" />
      <div className="h-4 bg-white/10 rounded w-full" />
      <div className="h-16 bg-white/10 rounded" />
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="relative h-6 bg-white/10 rounded-full overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
        style={{ width: `${clamped}%`, background: "linear-gradient(90deg, #C4728A, #e08fa0)" }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
        {fmtPct(clamped)}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FireTracker() {
  const { projection, assumptions, updateAssumptions, loading } = useFireProjection();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extraSavings, setExtraSavings] = useState("");

  // Local form state mirrors assumptions
  const [form, setForm] = useState({
    annual_expenses: "",
    savings_rate: "",
    expected_return: String(Math.round((assumptions.expected_return ?? 0.07) * 100)),
    withdrawal_rate: String(Math.round((assumptions.withdrawal_rate ?? 0.04) * 100)),
  });

  // Sync form when assumptions load
  const syncForm = () => {
    setForm({
      annual_expenses: assumptions.annual_expenses ? String(assumptions.annual_expenses) : "",
      savings_rate: assumptions.savings_rate ? String(assumptions.savings_rate) : "",
      expected_return: String(Math.round((assumptions.expected_return ?? 0.07) * 100)),
      withdrawal_rate: String(Math.round((assumptions.withdrawal_rate ?? 0.04) * 100)),
    });
  };

  const handleToggle = () => {
    if (!open) syncForm();
    setOpen((v) => !v);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAssumptions({
        annual_expenses: form.annual_expenses ? Number(form.annual_expenses) : undefined,
        savings_rate: form.savings_rate ? Number(form.savings_rate) : undefined,
        expected_return: Number(form.expected_return) / 100,
        withdrawal_rate: Number(form.withdrawal_rate) / 100,
      });
      toast.success("FIRE assumptions updated");
      setOpen(false);
    } catch {
      toast.error("Failed to save assumptions");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await updateAssumptions({ annual_expenses: undefined, savings_rate: undefined });
      toast.success("Reset to calculated values");
      setForm((f) => ({ ...f, annual_expenses: "", savings_rate: "" }));
    } catch {
      toast.error("Failed to reset");
    } finally {
      setSaving(false);
    }
  };

  // What-if projection
  const extraNum = Number(extraSavings) || 0;
  const whatIfMonths =
    projection && extraNum > 0
      ? calcMonthsToFi(
          projection.current_net_worth,
          projection.fi_number,
          projection.monthly_savings + extraNum,
          assumptions.expected_return
        )
      : null;
  const monthsSaved =
    projection?.months_to_fi != null && whatIfMonths !== null
      ? projection.months_to_fi - whatIfMonths
      : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <RiFireLine className="text-[#C4728A] text-xl" />
        <h2 className="text-lg font-semibold text-text-primary">FIRE Tracker</h2>
      </div>

      {loading ? (
        <Skeleton />
      ) : (
        <>
          {/* ── Progress Card ── */}
          <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl p-5 space-y-4">
            {projection ? (
              <>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-wide mb-1">FI Number</p>
                    <p className="text-2xl font-bold text-text-primary">{fmt(projection.fi_number)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Current Net Worth</p>
                    <p className="text-2xl font-bold text-text-primary">{fmt(projection.current_net_worth)}</p>
                  </div>
                </div>

                <ProgressBar pct={projection.progress_pct} />

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-white/[0.04] rounded-xl p-3">
                    <p className="text-xs text-text-muted mb-1">Projected FI Date</p>
                    {projection.months_to_fi === null && projection.current_net_worth >= projection.fi_number ? (
                      <p className="text-base font-semibold text-emerald-400">Already FI! 🎉</p>
                    ) : projection.projected_fi_date ? (
                      <p className="text-base font-semibold text-text-primary">{fmtDate(projection.projected_fi_date)}</p>
                    ) : (
                      <p className="text-sm text-text-muted">Add savings data</p>
                    )}
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3">
                    <p className="text-xs text-text-muted mb-1">Time Remaining</p>
                    <p className="text-base font-semibold text-text-primary">
                      ~{formatTimeToFi(projection.months_to_fi)}
                    </p>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3">
                    <p className="text-xs text-text-muted mb-1">Monthly Savings</p>
                    <p className="text-base font-semibold text-text-primary">{fmt(projection.monthly_savings)}</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3">
                    <p className="text-xs text-text-muted mb-1">Annual Expenses</p>
                    <p className="text-base font-semibold text-text-primary">{fmt(projection.annual_expenses)}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-text-muted text-sm">Add net worth snapshots and transactions to see your FIRE projection.</p>
            )}
          </div>

          {/* ── What-if Calculator ── */}
          {projection && (
            <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl p-5 space-y-3">
              <p className="text-sm font-semibold text-text-primary">What-if Calculator</p>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-secondary">Extra monthly savings:</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={extraSavings}
                    onChange={(e) => setExtraSavings(e.target.value)}
                    className="pl-7 pr-3 py-1.5 w-32 bg-white/[0.08] border border-white/[0.12] rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#C4728A]"
                  />
                </div>
              </div>
              {extraNum > 0 && (
                <div className="bg-[#C4728A]/10 border border-[#C4728A]/20 rounded-xl p-3 text-sm text-text-secondary">
                  {whatIfMonths === null ? (
                    <span className="text-emerald-400 font-medium">You&apos;d already be FI! 🎉</span>
                  ) : monthsSaved !== null && monthsSaved > 0 ? (
                    <>
                      Saving an extra <span className="text-text-primary font-medium">{fmt(extraNum)}/mo</span> gets
                      you to FI <span className="text-[#C4728A] font-medium">{formatTimeToFi(monthsSaved)} sooner</span>.
                    </>
                  ) : (
                    <>New projection: <span className="text-text-primary font-medium">{formatTimeToFi(whatIfMonths)}</span></>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Edit Assumptions ── */}
          <div className="bg-white/[0.04] border border-white/[0.10] rounded-2xl overflow-hidden">
            <button
              onClick={handleToggle}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              <span className="flex items-center gap-2">
                <RiEditLine />
                Edit Assumptions
              </span>
              {open ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
            </button>

            {open && (
              <div className="px-5 pb-5 space-y-4 border-t border-white/[0.08]">
                <div className="grid grid-cols-2 gap-4 pt-3">
                  <label className="space-y-1">
                    <span className="text-xs text-text-muted">Annual Expenses Override</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        placeholder={projection ? String(Math.round(projection.annual_expenses)) : "calculated"}
                        value={form.annual_expenses}
                        onChange={(e) => setForm((f) => ({ ...f, annual_expenses: e.target.value }))}
                        className="pl-7 pr-3 py-2 w-full bg-white/[0.08] border border-white/[0.12] rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#C4728A]"
                      />
                    </div>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-text-muted">Monthly Savings Override</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        placeholder={projection ? String(Math.round(projection.monthly_savings)) : "calculated"}
                        value={form.savings_rate}
                        onChange={(e) => setForm((f) => ({ ...f, savings_rate: e.target.value }))}
                        className="pl-7 pr-3 py-2 w-full bg-white/[0.08] border border-white/[0.12] rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-[#C4728A]"
                      />
                    </div>
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-text-muted">Expected Annual Return</span>
                    <span className="text-xs font-medium text-[#C4728A]">{form.expected_return}%</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="12"
                    step="0.5"
                    value={form.expected_return}
                    onChange={(e) => setForm((f) => ({ ...f, expected_return: e.target.value }))}
                    className="w-full accent-[#C4728A]"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>3%</span><span>12%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-text-muted">Safe Withdrawal Rate</span>
                    <span className="text-xs font-medium text-[#C4728A]">{form.withdrawal_rate}%</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="5"
                    step="0.1"
                    value={form.withdrawal_rate}
                    onChange={(e) => setForm((f) => ({ ...f, withdrawal_rate: e.target.value }))}
                    className="w-full accent-[#C4728A]"
                  />
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>3%</span><span>5%</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2 bg-[#C4728A]/80 hover:bg-[#C4728A] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={saving}
                    className="flex items-center gap-1 px-4 py-2 bg-white/[0.08] hover:bg-white/[0.15] text-text-secondary text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RiRefreshLine />
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

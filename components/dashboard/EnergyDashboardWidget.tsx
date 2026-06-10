"use client";
import { useEnergy } from "@/hooks/useEnergy";
import { RiFlashlightLine } from "react-icons/ri";

const LEVELS = [
  { score: 1, label: "Drained", color: "bg-danger/70" },
  { score: 2, label: "Very low", color: "bg-danger/50" },
  { score: 3, label: "Low", color: "bg-warning/60" },
  { score: 4, label: "Below avg", color: "bg-warning/80" },
  { score: 5, label: "Okay", color: "bg-amber-400/80" },
  { score: 6, label: "Decent", color: "bg-amber-400" },
  { score: 7, label: "Good", color: "bg-success/70" },
  { score: 8, label: "High", color: "bg-success/85" },
  { score: 9, label: "Very high", color: "bg-success" },
  { score: 10, label: "Peak", color: "bg-accent" },
];

function energyLabel(score: number) {
  return LEVELS[score - 1]?.label ?? "";
}
function energyColor(score: number) {
  return LEVELS[score - 1]?.color ?? "bg-bg-tertiary";
}

export default function EnergyDashboardWidget() {
  const { today, history, loading, logEnergy } = useEnergy();

  if (loading) return null;

  const last7 = history.slice(0, 7).reverse();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
          <RiFlashlightLine className="w-3.5 h-3.5" /> Energy Level
        </h2>
        {today && (
          <span className="text-xs font-medium text-text-primary">
            {today.score}/5 · <span className="text-text-muted">{energyLabel(today.score * 2)}</span>
          </span>
        )}
      </div>

      {!today ? (
        <div>
          <p className="text-xs text-text-muted mb-3">How&apos;s your energy right now?</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => logEnergy(s * 2)}
                className="flex-1 py-2 rounded-lg border border-bg-border hover:border-accent/50 text-sm font-medium text-text-primary hover:bg-bg-tertiary transition-all"
                title={energyLabel(s * 2)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-1 px-0.5">
            <span className="text-xs text-text-muted">Low</span>
            <span className="text-xs text-text-muted">Peak</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white ${energyColor(today.score)}`}>
              {Math.round(today.score / 2)}
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{energyLabel(today.score)}</p>
              {today.note && <p className="text-xs text-text-muted">{today.note}</p>}
            </div>
          </div>

          {last7.length > 1 && (
            <div className="flex items-end gap-1 h-8">
              {last7.map((entry) => (
                <div
                  key={entry.date}
                  title={`${entry.date}: ${entry.score}/10`}
                  className={`flex-1 rounded-sm ${energyColor(entry.score)} opacity-80`}
                  style={{ height: `${(entry.score / 10) * 28 + 4}px` }}
                />
              ))}
            </div>
          )}

          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => logEnergy(s * 2)}
                className={`flex-1 py-1 rounded text-xs font-medium transition-all border ${
                  today.score === s * 2
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-bg-border text-text-muted hover:border-accent/40 hover:text-text-primary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

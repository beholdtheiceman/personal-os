"use client";
import { useState } from "react";
import { useSleepData } from "@/hooks/useSleepData";
import { RiMoonLine, RiSettingsLine } from "react-icons/ri";
import { format, parseISO } from "date-fns";

function barColor(hours: number, target: number) {
  const ratio = hours / target;
  if (ratio >= 0.95) return "bg-success";
  if (ratio >= 0.8) return "bg-amber-400";
  return "bg-danger/70";
}

export default function SleepTrendWidget() {
  const { logs, targetHours, setTargetHours, sleepDebt, avgSleep, loading } = useSleepData(30);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [view, setView] = useState<30 | 90>(30);

  if (loading) return null;

  const display = logs.slice(0, view).reverse();
  const maxH = Math.max(...display.map((l) => l.sleep_hours), targetHours);

  const saveTarget = async () => {
    const h = parseFloat(targetInput);
    if (!isNaN(h) && h >= 4 && h <= 12) await setTargetHours(h);
    setEditingTarget(false);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
          <RiMoonLine className="w-3.5 h-3.5" /> Sleep Trends
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === 30 ? 90 : 30)}
            className="text-xs text-text-muted hover:text-text-primary px-2 py-0.5 rounded border border-bg-border hover:border-accent/40 transition-colors"
          >
            {view}d
          </button>
          <button
            onClick={() => { setTargetInput(String(targetHours)); setEditingTarget(true); }}
            className="text-text-muted hover:text-text-primary transition-colors"
            title="Set sleep target"
          >
            <RiSettingsLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-6 mb-4">
        <div>
          <p className="text-lg font-semibold text-text-primary">
            {avgSleep != null ? avgSleep.toFixed(1) : "—"}h
          </p>
          <p className="text-xs text-text-muted">7-day avg</p>
        </div>
        <div>
          <p className={`text-lg font-semibold ${sleepDebt > 5 ? "text-danger" : sleepDebt > 2 ? "text-amber-400" : "text-success"}`}>
            {sleepDebt > 0 ? `-${sleepDebt.toFixed(1)}h` : "✓"}
          </p>
          <p className="text-xs text-text-muted">7-day debt</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-text-primary">{targetHours}h</p>
          <p className="text-xs text-text-muted">target</p>
        </div>
      </div>

      {/* Bar chart */}
      {display.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4">No sleep data yet — connect Google Health or log manually</p>
      ) : (
        <div className="flex items-end gap-px" style={{ height: 64 }}>
          {display.map((log) => {
            const heightPct = (log.sleep_hours / maxH) * 60;
            const targetPct = (targetHours / maxH) * 60;
            return (
              <div
                key={log.date}
                className="flex-1 flex flex-col justify-end relative group"
                style={{ height: 64 }}
              >
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-accent/30"
                  style={{ bottom: targetPct }}
                />
                <div
                  className={`w-full rounded-t-sm ${barColor(log.sleep_hours, targetHours)} transition-all`}
                  style={{ height: heightPct }}
                />
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-bg-secondary border border-bg-border rounded px-1.5 py-0.5 text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                  {format(parseISO(log.date), "MMM d")} · {log.sleep_hours}h
                  {log.sleep_quality ? ` · Q${log.sleep_quality}/10` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingTarget && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            min={4} max={12} step={0.5}
            className="w-20 px-2 py-1 text-sm rounded border border-bg-border bg-bg-secondary text-text-primary focus:border-accent outline-none"
            placeholder="8"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") void saveTarget(); if (e.key === "Escape") setEditingTarget(false); }}
          />
          <span className="text-xs text-text-muted">hours target</span>
          <button onClick={() => void saveTarget()} className="text-xs text-accent hover:text-accent-text">Save</button>
          <button onClick={() => setEditingTarget(false)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
        </div>
      )}
    </div>
  );
}

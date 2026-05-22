"use client";
import { useState } from "react";
import { RiScalesLine, RiEditLine, RiCheckLine } from "react-icons/ri";
import { useBodyMetrics } from "@/hooks/useBodyMetrics";
import type { BodyMetricsEntry } from "@/types";

type MetricKey = keyof Omit<BodyMetricsEntry, "id" | "date" | "logged_at">;

const METRICS: { key: MetricKey; label: string; unit: string; placeholder: string }[] = [
  { key: "weight_lbs",    label: "Weight",     unit: "lbs", placeholder: "e.g. 175" },
  { key: "body_fat_pct",  label: "Body Fat",   unit: "%",   placeholder: "e.g. 18" },
  { key: "chest_in",      label: "Chest",      unit: "in",  placeholder: "e.g. 40" },
  { key: "waist_in",      label: "Waist",      unit: "in",  placeholder: "e.g. 32" },
  { key: "hips_in",       label: "Hips",       unit: "in",  placeholder: "e.g. 38" },
  { key: "arms_in",       label: "Arms",       unit: "in",  placeholder: "e.g. 14" },
];

export default function BodyMetricsWidget() {
  const { today, history, latest, loading, logMetrics } = useBodyMetrics();
  const [editing, setEditing] = useState(!today);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (loading) return null;

  const handleSave = async () => {
    setSaving(true);
    const data: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(form)) {
      const n = parseFloat(v);
      if (!isNaN(n)) data[k] = n;
    }
    if (form.notes) data.notes = form.notes;
    await logMetrics(data as Omit<BodyMetricsEntry, "id" | "date" | "logged_at">);
    setSaving(false);
    setEditing(false);
  };

  // Weight trend for mini chart (last 10 entries with weight)
  const weightHistory = history
    .filter((e) => e.weight_lbs != null)
    .slice(0, 10)
    .reverse();

  const displayEntry = today ?? latest;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiScalesLine className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Body Metrics</h2>
        </div>
        {!editing && (
          <button
            onClick={() => {
              // Pre-fill form with today's values
              const src = today ?? {};
              const prefill: Record<string, string> = {};
              for (const { key } of METRICS) {
                const v = (src as unknown as Record<string, unknown>)[key];
                if (v != null) prefill[key] = String(v);
              }
              setForm(prefill);
              setEditing(true);
            }}
            className="btn-ghost text-xs py-1 px-2 flex items-center gap-1"
          >
            <RiEditLine className="w-3.5 h-3.5" />
            {today ? "Update" : "Log today"}
          </button>
        )}
      </div>

      {/* Current values display */}
      {!editing && displayEntry && (
        <div className="grid grid-cols-3 gap-2">
          {METRICS.map(({ key, label, unit }) => {
            const val = (displayEntry as unknown as Record<string, unknown>)[key];
            if (val == null) return null;
            return (
              <div key={key} className="bg-white/5 rounded-lg p-2 text-center">
                <p className="text-xs text-text-muted">{label}</p>
                <p className="text-sm font-semibold text-text-primary mt-0.5">
                  {String(val)} <span className="text-xs font-normal text-text-muted">{unit}</span>
                </p>
              </div>
            );
          })}
        </div>
      )}

      {!editing && !displayEntry && (
        <p className="text-xs text-text-muted">No metrics logged yet. Tap "Log today" to start.</p>
      )}

      {/* Log form */}
      {editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {METRICS.map(({ key, label, unit, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-text-muted mb-1 block">{label} ({unit})</label>
                <input
                  type="number"
                  step="0.1"
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="input-base text-sm"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Notes (optional)</label>
            <input
              type="text"
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes..."
              className="input-base text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-1.5 flex items-center gap-1.5">
              <RiCheckLine className="w-4 h-4" />
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost text-sm py-1.5">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Weight trend mini-chart */}
      {weightHistory.length > 1 && (
        <div className="pt-2 border-t border-bg-border">
          <p className="text-xs text-text-muted mb-2">Weight trend</p>
          <div className="flex items-end gap-1 h-10">
            {(() => {
              const vals = weightHistory.map((e) => e.weight_lbs!);
              const min = Math.min(...vals);
              const max = Math.max(...vals);
              const range = max - min || 1;
              return weightHistory.map((entry, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${entry.date}: ${entry.weight_lbs} lbs`}>
                  <div
                    className="w-full rounded-sm bg-accent/60"
                    style={{ height: `${((entry.weight_lbs! - min) / range) * 32 + 4}px` }}
                  />
                </div>
              ));
            })()}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-text-muted">{weightHistory[0]?.weight_lbs} lbs</span>
            <span className="text-xs text-text-muted">{weightHistory[weightHistory.length - 1]?.weight_lbs} lbs</span>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { RiCloseLine, RiSaveLine } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";

interface FormData {
  sleep_hours: number;
  sleep_quality: number;
  energy_level: number;
  exercise_done: boolean;
  exercise_description: string;
  notes: string;
}

interface Props {
  initial?: Partial<FormData>;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
}

function Slider({
  label, value, min, max, step = 1, onChange, suffix = "",
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary font-medium">{label}</span>
        <span className="text-text-primary font-semibold">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

export default function HealthForm({ initial, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormData>({
    sleep_hours: initial?.sleep_hours ?? 7,
    sleep_quality: initial?.sleep_quality ?? 7,
    energy_level: initial?.energy_level ?? 7,
    exercise_done: initial?.exercise_done ?? false,
    exercise_description: initial?.exercise_description ?? "",
    notes: initial?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-bg-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border">
          <h2 className="font-semibold text-text-primary">Log Today's Health</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <Slider label="Sleep Hours" value={form.sleep_hours} min={0} max={12} step={0.5}
            onChange={(v) => set("sleep_hours", v)} suffix="h" />
          <Slider label="Sleep Quality" value={form.sleep_quality} min={1} max={10}
            onChange={(v) => set("sleep_quality", v)} suffix="/10" />
          <Slider label="Readiness Score" value={form.energy_level * 10} min={0} max={100} step={5}
            onChange={(v) => set("energy_level", Math.max(1, Math.round(v / 10)))} suffix="/100" />

          {/* Exercise */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => set("exercise_done", !form.exercise_done)}
                className={`w-10 h-6 rounded-full flex items-center transition-all ${
                  form.exercise_done ? "bg-success justify-end pr-1" : "bg-bg-tertiary border border-bg-border justify-start pl-1"
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </div>
              <span className="text-sm text-text-primary font-medium">Exercised today</span>
            </label>
            {form.exercise_done && (
              <input
                type="text"
                value={form.exercise_description}
                onChange={(e) => set("exercise_description", e.target.value)}
                placeholder="e.g. 30min run, weights, yoga…"
                className="w-full bg-bg-tertiary border border-bg-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any other notes about how you feel today… (optional)"
              rows={2}
              className="w-full bg-bg-tertiary border border-bg-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost text-sm flex-1">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm flex-1 flex items-center justify-center gap-2"
            >
              {saving ? <LoadingDots /> : <><RiSaveLine className="w-4 h-4" /> Save Log</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

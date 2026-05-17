"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { Habit } from "@/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface HabitFormProps {
  initial?: Habit;
  onSave: (data: Partial<Habit>) => Promise<void>;
  onClose: () => void;
}

export default function HabitForm({ initial, onSave, onClose }: HabitFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [targetDays, setTargetDays] = useState<number[]>(
    initial?.target_days ?? [1, 2, 3, 4, 5] // Mon–Fri default
  );
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: number) =>
    setTargetDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), category, target_days: targetDays });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit Habit" : "New Habit"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Habit Name *</label>
          <input
            className="input-base"
            placeholder='e.g. "Morning workout", "Read 20 pages"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Category</label>
          <input
            className="input-base"
            placeholder='e.g. "Health", "Mindset"'
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Target Days</label>
          <div className="flex gap-1.5">
            {DAYS.map((day, i) => (
              <button
                key={day}
                onClick={() => toggleDay(i)}
                className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                  targetDays.includes(i)
                    ? "bg-accent/20 border-accent/40 text-accent-text"
                    : "border-bg-border text-text-secondary hover:border-accent/30"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {initial ? "Save Changes" : "Create Habit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

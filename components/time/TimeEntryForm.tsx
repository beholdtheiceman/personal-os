"use client";
import { useState } from "react";
import { RiAddLine, RiTimeLine } from "react-icons/ri";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import type { TimeCategory } from "@/types";

const CATEGORIES: { value: TimeCategory; label: string }[] = [
  { value: "work",     label: "Work" },
  { value: "personal", label: "Personal" },
  { value: "health",   label: "Health" },
  { value: "learning", label: "Learning" },
  { value: "other",    label: "Other" },
];

export default function TimeEntryForm({ onSaved }: { onSaved?: () => void }) {
  const { addEntry } = useTimeTracker();
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [category, setCategory] = useState<TimeCategory>("work");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const totalMin = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

  const handleSave = async () => {
    if (!description.trim() || totalMin <= 0) return;
    setSaving(true);
    await addEntry({ description: description.trim(), duration_min: totalMin, category });
    setDescription("");
    setHours("");
    setMinutes("");
    setSaving(false);
    setOpen(false);
    onSaved?.();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-text"
      >
        <RiAddLine className="w-4 h-4" /> Log time
      </button>
    );
  }

  return (
    <div className="border border-bg-border rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Log Time</p>

      <input
        className="input-base w-full text-sm py-1.5 px-3"
        placeholder="What did you work on?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }}
        autoFocus
      />

      <div className="flex items-center gap-3">
        <RiTimeLine className="w-4 h-4 text-text-muted shrink-0" />
        <div className="flex items-center gap-1.5">
          <input
            type="number" min={0} max={23} placeholder="h"
            className="input-base w-14 text-xs py-1.5 px-2"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
          <span className="text-text-muted text-xs">h</span>
          <input
            type="number" min={0} max={59} placeholder="m"
            className="input-base w-14 text-xs py-1.5 px-2"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
          <span className="text-text-muted text-xs">min</span>
        </div>

        <select
          className="input-base flex-1 text-xs py-1.5 px-2"
          value={category}
          onChange={(e) => setCategory(e.target.value as TimeCategory)}
        >
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !description.trim() || totalMin <= 0}
          className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-text-muted hover:text-text-secondary px-3">
          Cancel
        </button>
      </div>
    </div>
  );
}

"use client";
// HabitSuggestionCard (PA-5) — renders one Claude-suggested starter habit with its
// rationale and Add / Skip actions. Used by HabitsTracker's empty state.
import { RiCheckLine, RiCloseLine } from "react-icons/ri";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface HabitSuggestion {
  name: string;
  category: string;
  target_days: number[];
  timing: string;
  rationale: string;
}

export default function HabitSuggestionCard({
  suggestion,
  onAdd,
  onSkip,
}: {
  suggestion: HabitSuggestion;
  onAdd: (s: HabitSuggestion) => void;
  onSkip: (s: HabitSuggestion) => void;
}) {
  const daysLabel =
    suggestion.target_days.length === 7
      ? "Daily"
      : suggestion.target_days.length === 5 && [1, 2, 3, 4, 5].every((d) => suggestion.target_days.includes(d))
        ? "Weekdays"
        : suggestion.target_days.map((d) => DAY_LABELS[d]).join(" ");

  return (
    <div className="card space-y-2 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{suggestion.name}</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {daysLabel}
            {suggestion.timing ? ` · ${suggestion.timing}` : ""}
            {suggestion.category ? ` · ${suggestion.category}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onAdd(suggestion)}
            className="flex items-center gap-1 text-xs btn-primary px-2.5 py-1.5"
            title="Add this habit"
          >
            <RiCheckLine className="w-3.5 h-3.5" /> Add
          </button>
          <button
            onClick={() => onSkip(suggestion)}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary px-2 py-1.5 rounded-lg hover:bg-bg-tertiary border border-bg-border transition-colors"
            title="Skip"
          >
            <RiCloseLine className="w-3.5 h-3.5" /> Skip
          </button>
        </div>
      </div>
      {suggestion.rationale && (
        <p className="text-xs text-text-secondary italic border-t border-bg-border pt-2">{suggestion.rationale}</p>
      )}
    </div>
  );
}

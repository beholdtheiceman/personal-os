"use client";
import { useState } from "react";
import { RiDeleteBinLine, RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { format } from "date-fns";
import type { JournalEntry } from "@/types";

const MOOD_COLORS: Record<number, string> = {
  1: "text-red-400", 2: "text-red-400", 3: "text-orange-400",
  4: "text-orange-400", 5: "text-yellow-400", 6: "text-yellow-400",
  7: "text-lime-400", 8: "text-green-400", 9: "text-emerald-400", 10: "text-emerald-400",
};

const MOOD_LABELS: Record<number, string> = {
  1: "Terrible", 2: "Bad", 3: "Low", 4: "Below avg", 5: "Neutral",
  6: "Okay", 7: "Good", 8: "Great", 9: "Excellent", 10: "Amazing",
};

interface Props {
  entry: JournalEntry;
  onDelete: (id: string) => void;
}

export default function JournalEntryCard({ entry, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const moodColor = MOOD_COLORS[entry.mood_score] ?? "text-text-muted";
  const moodLabel = MOOD_LABELS[entry.mood_score] ?? "";

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-text-muted">
              {format(
                typeof entry.created_at === "string"
                  ? new Date(entry.created_at)
                  : (entry.created_at as { toDate: () => Date }).toDate?.() ?? new Date(),
                "MMM d, yyyy · h:mm a"
              )}
            </span>
            <span className={`text-xs font-semibold ${moodColor}`}>
              {entry.mood_score}/10 · {moodLabel}
            </span>
          </div>
          <p className="text-sm text-text-primary">{entry.ai_summary}</p>
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          className="shrink-0 text-text-muted hover:text-danger transition-colors"
        >
          <RiDeleteBinLine className="w-4 h-4" />
        </button>
      </div>

      {entry.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-xs bg-accent/10 text-accent border border-accent/20"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        {expanded ? <RiArrowUpSLine className="w-4 h-4" /> : <RiArrowDownSLine className="w-4 h-4" />}
        {expanded ? "Hide" : "Show"} full entry
      </button>

      {expanded && (
        <div className="border-t border-bg-border pt-3">
          <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
            {entry.raw_transcript}
          </p>
        </div>
      )}
    </div>
  );
}

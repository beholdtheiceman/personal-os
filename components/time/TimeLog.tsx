"use client";
import { RiDeleteBinLine, RiTimeLine } from "react-icons/ri";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { format, parseISO } from "date-fns";
import type { TimeEntry } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  work:     "bg-blue-500/20 text-blue-300",
  personal: "bg-purple-500/20 text-purple-300",
  health:   "bg-green-500/20 text-green-300",
  learning: "bg-amber-500/20 text-amber-300",
  other:    "bg-bg-tertiary text-text-muted",
};

function fmtDuration(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function EntryRow({ entry, onDelete }: { entry: TimeEntry; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-bg-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{entry.description}</p>
        <p className="text-xs text-text-muted">
          {format(parseISO(entry.start_time), "h:mm a")}
          {" → "}
          {format(parseISO(entry.end_time), "h:mm a")}
          {entry.source === "timer" && <span className="ml-1 text-accent">· timer</span>}
        </p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS.other}`}>
        {entry.category}
      </span>
      <span className="text-sm font-semibold text-text-primary shrink-0 w-12 text-right">
        {fmtDuration(entry.duration_min)}
      </span>
      <button onClick={onDelete} className="text-text-muted hover:text-red-400 shrink-0">
        <RiDeleteBinLine className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface Props {
  date?: string; // YYYY-MM-DD — defaults to today
}

export default function TimeLog({ date }: Props) {
  const { todayEntries, entries, deleteEntry, loading } = useTimeTracker();
  const displayEntries = date
    ? entries.filter((e) => e.date === date)
    : todayEntries;

  const totalMin = displayEntries.reduce((s, e) => s + e.duration_min, 0);

  if (loading) return <div className="py-6 text-center text-text-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-1">
      {displayEntries.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">Nothing logged yet today.</p>
      ) : (
        <>
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <RiTimeLine className="w-3.5 h-3.5" />
              <span>{displayEntries.length} entries · {fmtDuration(totalMin)} total</span>
            </div>
          </div>
          {displayEntries.map((e) => (
            <EntryRow key={e.id} entry={e} onDelete={() => deleteEntry(e.id)} />
          ))}
        </>
      )}
    </div>
  );
}

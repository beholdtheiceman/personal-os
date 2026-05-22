"use client";
import { useState } from "react";
import { RiArrowDownSLine, RiArrowUpSLine, RiTimeLine } from "react-icons/ri";
import { useWorkout } from "@/hooks/useWorkout";
import { format, parseISO } from "date-fns";
import type { WorkoutSession } from "@/types";

function SessionCard({ session }: { session: WorkoutSession }) {
  const [expanded, setExpanded] = useState(false);
  const totalSets = session.exercises.reduce((s, e) => s + e.sets.length, 0);

  return (
    <div className="border border-bg-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{session.name}</p>
          <p className="text-xs text-text-muted">
            {format(parseISO(session.date), "EEE, MMM d")}
            {" · "}{session.exercises.length} exercise{session.exercises.length !== 1 ? "s" : ""}
            {" · "}{totalSets} sets
          </p>
        </div>
        {session.duration_min && (
          <div className="flex items-center gap-1 text-xs text-text-muted shrink-0">
            <RiTimeLine className="w-3.5 h-3.5" />
            {session.duration_min}m
          </div>
        )}
        {expanded ? <RiArrowUpSLine className="w-4 h-4 text-text-muted shrink-0" /> : <RiArrowDownSLine className="w-4 h-4 text-text-muted shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-bg-border px-4 py-3 space-y-3">
          {session.exercises.map((ex, i) => (
            <div key={i} className="space-y-1">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{ex.exercise_name}</p>
              <div className="flex flex-wrap gap-2">
                {ex.sets.map((s, j) => (
                  <span key={j} className="text-xs bg-bg-tertiary rounded-lg px-2 py-1 text-text-secondary">
                    {s.reps} × {s.weight}{s.unit}
                  </span>
                ))}
              </div>
              {ex.notes && <p className="text-xs text-text-muted italic">{ex.notes}</p>}
            </div>
          ))}
          {session.notes && (
            <p className="text-xs text-text-muted border-t border-bg-border pt-2 italic">{session.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function WorkoutHistory() {
  const { sessions, loading } = useWorkout();

  if (loading) return <div className="py-8 text-center text-text-muted text-sm">Loading…</div>;
  if (sessions.length === 0) {
    return <p className="text-sm text-text-muted text-center py-12">No workouts logged yet. Start on the Log tab!</p>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => <SessionCard key={s.id} session={s} />)}
    </div>
  );
}

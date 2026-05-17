"use client";
import { useState } from "react";
import { format, isPast, parseISO } from "date-fns";
import {
  RiCheckLine, RiDeleteBinLine, RiEditLine, RiCalendarLine,
  RiSparklingLine, RiLoader4Line,
} from "react-icons/ri";
import type { Goal, GoalCategory } from "@/types";

const CATEGORY_COLORS: Record<GoalCategory, string> = {
  personal:  "bg-info/15 text-info",
  business:  "bg-accent/15 text-accent-text",
  health:    "bg-success/15 text-success",
  financial: "bg-warning/15 text-warning",
};

interface GoalCardProps {
  goal: Goal;
  onToggleMilestone: (goalId: string, idx: number) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Goal["status"]) => void;
}

export default function GoalCard({ goal, onToggleMilestone, onEdit, onDelete, onStatusChange }: GoalCardProps) {
  const [checkin, setCheckin] = useState("");
  const [loadingCheckin, setLoadingCheckin] = useState(false);

  const completed = goal.milestones.filter((m) => m.completed).length;
  const total = goal.milestones.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const overdue = goal.target_date && isPast(parseISO(goal.target_date)) && goal.status === "active";

  const getCheckin = async () => {
    setLoadingCheckin(true);
    setCheckin("");
    try {
      const res = await fetch("/api/goals/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goal),
      });
      const data = await res.json();
      setCheckin(data.message ?? "");
    } finally {
      setLoadingCheckin(false);
    }
  };

  return (
    <div className={`card space-y-3 ${goal.status === "achieved" ? "opacity-70" : ""}`}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[goal.category]}`}>
              {goal.category}
            </span>
            {goal.status === "achieved" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success">achieved</span>
            )}
            {goal.status === "paused" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted">paused</span>
            )}
          </div>
          <h3 className={`text-sm font-semibold text-text-primary mt-1 ${goal.status === "achieved" ? "line-through" : ""}`}>
            {goal.title}
          </h3>
          {goal.description && (
            <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{goal.description}</p>
          )}
          {goal.target_date && (
            <div className={`flex items-center gap-1 text-[11px] mt-1 ${overdue ? "text-danger" : "text-text-muted"}`}>
              <RiCalendarLine className="w-3 h-3" />
              {overdue ? "Overdue · " : ""}
              {format(parseISO(goal.target_date), "MMM d, yyyy")}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(goal)} className="p-1 text-text-muted hover:text-accent rounded">
            <RiEditLine className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(goal.id)} className="p-1 text-text-muted hover:text-danger rounded">
            <RiDeleteBinLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div>
          <div className="flex justify-between text-[11px] text-text-muted mb-1">
            <span>{completed}/{total} milestones</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Milestones */}
      {goal.milestones.length > 0 && (
        <div className="space-y-1.5">
          {goal.milestones.map((m, i) => (
            <button
              key={i}
              onClick={() => onToggleMilestone(goal.id, i)}
              className="w-full flex items-center gap-2 text-left group"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                m.completed ? "bg-success border-success" : "border-bg-border group-hover:border-success"
              }`}>
                {m.completed && <RiCheckLine className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className={`text-xs ${m.completed ? "line-through text-text-muted" : "text-text-secondary"}`}>
                {m.title}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Status actions + AI check-in */}
      <div className="flex items-center gap-2 pt-1 border-t border-bg-border">
        {goal.status === "active" && (
          <>
            <button
              onClick={() => onStatusChange(goal.id, "achieved")}
              className="text-[11px] px-2 py-1 rounded bg-success/10 text-success hover:bg-success/20 transition-colors"
            >
              Mark achieved
            </button>
            <button
              onClick={() => onStatusChange(goal.id, "paused")}
              className="text-[11px] px-2 py-1 rounded bg-bg-tertiary text-text-muted hover:bg-bg-border transition-colors"
            >
              Pause
            </button>
          </>
        )}
        {goal.status !== "active" && (
          <button
            onClick={() => onStatusChange(goal.id, "active")}
            className="text-[11px] px-2 py-1 rounded bg-accent/10 text-accent-text hover:bg-accent/20 transition-colors"
          >
            Reactivate
          </button>
        )}
        <button
          onClick={getCheckin}
          disabled={loadingCheckin}
          className="ml-auto flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-bg-tertiary text-text-secondary hover:bg-bg-border transition-colors disabled:opacity-50"
        >
          {loadingCheckin ? <RiLoader4Line className="w-3 h-3 animate-spin" /> : <RiSparklingLine className="w-3 h-3" />}
          AI check-in
        </button>
      </div>

      {/* AI check-in message */}
      {checkin && (
        <div className="text-xs text-text-secondary bg-accent/5 border border-accent/20 rounded-lg p-3 leading-relaxed">
          {checkin}
        </div>
      )}
    </div>
  );
}

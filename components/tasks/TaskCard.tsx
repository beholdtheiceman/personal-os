"use client";
import { useState } from "react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import {
  RiCheckLine, RiDeleteBinLine, RiEditLine, RiCalendarLine,
  RiArrowUpLine, RiArrowDownLine, RiRepeatLine,
} from "react-icons/ri";
import type { Task, TaskTag } from "@/types";

const TAG_COLORS: Record<TaskTag, string> = {
  personal: "bg-info/15 text-info",
  business: "bg-accent/15 text-accent-text",
  health:   "bg-success/15 text-success",
  finance:  "bg-warning/15 text-warning",
};

function priorityColor(score: number) {
  if (score >= 80) return "bg-danger/20 text-danger border-danger/30";
  if (score >= 60) return "bg-warning/20 text-warning border-warning/30";
  if (score >= 40) return "bg-info/20 text-info border-info/30";
  return "bg-bg-tertiary text-text-muted border-bg-border";
}

function formatDue(date: string | null) {
  if (!date) return null;
  const d = new Date(date);
  if (isToday(d)) return { label: "Today", urgent: true };
  if (isTomorrow(d)) return { label: "Tomorrow", urgent: false };
  if (isPast(d)) return { label: format(d, "MMM d") + " (overdue)", urgent: true };
  return { label: format(d, "MMM d"), urgent: false };
}

interface TaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  compact?: boolean;
}

export default function TaskCard({ task, onComplete, onDelete, onEdit, compact }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const due = formatDue(task.due_date);
  const done = task.status === "completed";

  return (
    <div
      className={`group flex items-start gap-3 p-3 rounded-xl border transition-all ${
        done
          ? "border-bg-border bg-bg-secondary/50 opacity-60"
          : "border-bg-border bg-bg-secondary hover:border-accent/30"
      }`}
    >
      {/* Complete checkbox */}
      <button
        onClick={() => onComplete(task.id)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          done
            ? "bg-success border-success"
            : "border-bg-border hover:border-success"
        }`}
      >
        {done && <RiCheckLine className="w-3 h-3 text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0" onClick={() => !compact && setExpanded((p) => !p)}>
        <div className="flex items-start gap-2 flex-wrap">
          <span className={`text-sm font-medium flex-1 ${done ? "line-through text-text-muted" : "text-text-primary"}`}>
            {task.title}
          </span>

          {/* Priority badge */}
          <span className={`text-xs px-2 py-0.5 rounded-full border font-mono ${priorityColor(task.priority_score)}`}>
            {task.priority_score}
          </span>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {task.tags.map((tag) => (
            <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full ${TAG_COLORS[tag]}`}>
              {tag}
            </span>
          ))}
          {due && (
            <span className={`text-[10px] flex items-center gap-1 ${due.urgent ? "text-danger" : "text-text-muted"}`}>
              <RiCalendarLine className="w-3 h-3" />
              {due.label}
            </span>
          )}
          {task.recurrence && (
            <span className="text-[10px] flex items-center gap-1 text-text-muted capitalize">
              <RiRepeatLine className="w-3 h-3" />
              {task.recurrence}
            </span>
          )}
        </div>

        {/* Expanded description */}
        {expanded && task.description && (
          <p className="mt-2 text-xs text-text-secondary leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(task)}
          className="p-1 text-text-muted hover:text-accent rounded"
        >
          <RiEditLine className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="p-1 text-text-muted hover:text-danger rounded"
        >
          <RiDeleteBinLine className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

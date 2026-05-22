"use client";
// Modal form for adding or editing a task — calls Claude to auto-score on save
import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import LoadingDots from "@/components/ui/LoadingDots";
import type { Task, TaskTag, RecurrenceCadence } from "@/types";

const ALL_TAGS: TaskTag[] = ["personal", "business", "health", "finance"];
const RECURRENCE_OPTIONS: { value: RecurrenceCadence | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

interface TaskFormProps {
  initial?: Task;
  onSave: (data: Partial<Task>) => Promise<void>;
  onClose: () => void;
}

export default function TaskForm({ initial, onSave, onClose }: TaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState<TaskTag[]>(initial?.tags ?? ["personal"]);
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [recurrence, setRecurrence] = useState<RecurrenceCadence | "none">(initial?.recurrence ?? "none");
  const [recurrenceEnd, setRecurrenceEnd] = useState(initial?.recurrence_end ?? "");
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: TaskTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      // Get AI priority score
      const scoreRes = await fetch("/api/tasks/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, tags, due_date: dueDate || null }),
      });
      const { score } = await scoreRes.json();

      await onSave({
        title: title.trim(),
        description: description.trim(),
        tags,
        due_date: dueDate || null,
        priority_score: score ?? 50,
        source: "manual",
        recurrence: recurrence === "none" ? null : recurrence,
        recurrence_end: recurrence === "none" ? null : (recurrenceEnd || null),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit Task" : "New Task"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Title *</label>
          <input
            className="input-base"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Description</label>
          <textarea
            className="input-base resize-none h-20 text-sm"
            placeholder="Optional details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Due Date</label>
          <input
            type="date"
            className="input-base"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Repeat</label>
          <div className="flex gap-2 flex-wrap">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRecurrence(opt.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  recurrence === opt.value
                    ? "bg-accent/20 border-accent/40 text-accent-text"
                    : "border-bg-border text-text-secondary hover:border-accent/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {recurrence !== "none" && (
            <div className="mt-2">
              <label className="text-xs text-text-secondary mb-1.5 block">Repeat until (optional)</label>
              <input
                type="date"
                className="input-base"
                value={recurrenceEnd}
                onChange={(e) => setRecurrenceEnd(e.target.value)}
              />
              <p className="text-[11px] text-text-muted mt-1">
                A new task is created automatically each time you complete this one.
              </p>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Tags</label>
          <div className="flex gap-2 flex-wrap">
            {ALL_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
                  tags.includes(tag)
                    ? "bg-accent/20 border-accent/40 text-accent-text"
                    : "border-bg-border text-text-secondary hover:border-accent/30"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-text-muted">
          Claude will auto-score priority when you save.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || saving}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <LoadingDots /> : initial ? "Save Changes" : "Add Task"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

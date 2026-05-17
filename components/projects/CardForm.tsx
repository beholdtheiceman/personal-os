"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import LoadingDots from "@/components/ui/LoadingDots";
import type { KanbanCard, KanbanStatus } from "@/types";

interface CardFormProps {
  initial?: KanbanCard;
  defaultStatus?: KanbanStatus;
  onSave: (data: Partial<KanbanCard>) => Promise<void>;
  onClose: () => void;
}

const PRIORITIES = ["low", "medium", "high"] as const;

export default function CardForm({ initial, defaultStatus = "todo", onSave, onClose }: CardFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<KanbanCard["priority"]>(initial?.priority ?? "medium");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), priority, status: initial?.status ?? defaultStatus });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit Card" : "New Card"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Title *</label>
          <input className="input-base" placeholder="What needs to be done?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Description</label>
          <textarea className="input-base resize-none h-20 text-sm" placeholder="Optional details..." value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Priority</label>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${
                  priority === p
                    ? p === "high" ? "bg-danger/20 border-danger/40 text-danger"
                      : p === "medium" ? "bg-warning/20 border-warning/40 text-warning"
                      : "bg-info/20 border-info/40 text-info"
                    : "border-bg-border text-text-secondary hover:border-accent/30"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim() || saving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
            {saving ? <LoadingDots /> : initial ? "Save" : "Add Card"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

"use client";
import { useState } from "react";
import { RiAddLine, RiDeleteBinLine } from "react-icons/ri";
import Modal from "@/components/ui/Modal";
import LoadingDots from "@/components/ui/LoadingDots";
import type { Goal, GoalCategory, GoalMilestone } from "@/types";

const CATEGORIES: GoalCategory[] = ["personal", "business", "health", "financial"];

interface GoalFormProps {
  initial?: Goal;
  onSave: (data: Partial<Goal>) => Promise<void>;
  onClose: () => void;
}

export default function GoalForm({ initial, onSave, onClose }: GoalFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<GoalCategory>(initial?.category ?? "personal");
  const [targetDate, setTargetDate] = useState(initial?.target_date ?? "");
  const [milestones, setMilestones] = useState<GoalMilestone[]>(initial?.milestones ?? []);
  const [newMilestone, setNewMilestone] = useState("");
  const [saving, setSaving] = useState(false);

  const addMilestone = () => {
    const t = newMilestone.trim();
    if (!t) return;
    setMilestones((prev) => [...prev, { title: t, completed: false }]);
    setNewMilestone("");
  };

  const removeMilestone = (i: number) => {
    setMilestones((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), category, target_date: targetDate || "", milestones });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit Goal" : "New Goal"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Title *</label>
          <input className="input-base" placeholder="What do you want to achieve?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Description</label>
          <textarea className="input-base resize-none h-20 text-sm" placeholder="Why does this matter?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Category</label>
            <select className="input-base" value={category} onChange={(e) => setCategory(e.target.value as GoalCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Target Date</label>
            <input type="date" className="input-base" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Milestones</label>
          <div className="space-y-1.5 mb-2">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span className="flex-1 text-text-primary">{m.title}</span>
                <button onClick={() => removeMilestone(i)} className="text-text-muted hover:text-danger">
                  <RiDeleteBinLine className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input-base flex-1 text-sm"
              placeholder="Add a milestone..."
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMilestone()}
            />
            <button onClick={addMilestone} className="btn-ghost px-2">
              <RiAddLine className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim() || saving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
            {saving ? <LoadingDots /> : initial ? "Save Changes" : "Add Goal"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

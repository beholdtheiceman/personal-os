"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import LoadingDots from "@/components/ui/LoadingDots";
import type { Project } from "@/types";

const COLORS = [
  { label: "Blue",   value: "#6C8EF5" },
  { label: "Purple", value: "#A78BFA" },
  { label: "Green",  value: "#34D399" },
  { label: "Orange", value: "#FB923C" },
  { label: "Pink",   value: "#F472B6" },
  { label: "Teal",   value: "#2DD4BF" },
];

interface ProjectFormProps {
  initial?: Project;
  onSave: (data: Partial<Project>) => Promise<void>;
  onClose: () => void;
}

export default function ProjectForm({ initial, onSave, onClose }: ProjectFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color_tag ?? COLORS[0].value);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), color_tag: color, status: "active" });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit Project" : "New Project"} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Project Name *</label>
          <input className="input-base" placeholder="What are you building?" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Description</label>
          <textarea className="input-base resize-none h-20 text-sm" placeholder="Brief overview..." value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-2 block">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${color === c.value ? "border-white scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={!name.trim() || saving} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
            {saving ? <LoadingDots /> : initial ? "Save Changes" : "Create Project"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

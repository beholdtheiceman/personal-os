"use client";
import { useState } from "react";
import { format, addDays } from "date-fns";
import { useDecisions } from "@/hooks/useDecisions";
import type { Decision } from "@/types";

interface Props {
  onClose: () => void;
  initial?: Decision;
}

export default function DecisionForm({ onClose, initial }: Props) {
  const { addDecision, updateDecision } = useDecisions();
  const today = format(new Date(), "yyyy-MM-dd");
  const defaultReview = format(addDays(new Date(), 30), "yyyy-MM-dd");

  const [form, setForm] = useState({
    title: initial?.title ?? "",
    date: initial?.date ?? today,
    context: initial?.context ?? "",
    options_considered: (initial?.options_considered ?? [""]).join("\n"),
    chosen_option: initial?.chosen_option ?? "",
    reasoning: initial?.reasoning ?? "",
    expected_outcome: initial?.expected_outcome ?? "",
    review_date: initial?.review_date ?? defaultReview,
    tags: (initial?.tags ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.chosen_option) return;
    setSaving(true);
    const options = form.options_considered.split("\n").map((s) => s.trim()).filter(Boolean);
    const tags = form.tags.split(",").map((s) => s.trim()).filter(Boolean);
    const payload = {
      title: form.title,
      date: form.date,
      context: form.context,
      options_considered: options,
      chosen_option: form.chosen_option,
      reasoning: form.reasoning,
      expected_outcome: form.expected_outcome,
      review_date: form.review_date,
      tags,
    };
    if (initial) {
      await updateDecision(initial.id, payload);
    } else {
      await addDecision(payload);
    }
    setSaving(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Decision title *</label>
        <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="What did you decide?" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Decision date</label>
          <input type="date" className="input" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div>
          <label className="label">Review date</label>
          <input type="date" className="input" value={form.review_date} onChange={(e) => set("review_date", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Context / background</label>
        <textarea className="input min-h-[72px] resize-none" value={form.context} onChange={(e) => set("context", e.target.value)} placeholder="What situation led to this decision?" />
      </div>
      <div>
        <label className="label">Options considered (one per line)</label>
        <textarea className="input min-h-[72px] resize-none" value={form.options_considered} onChange={(e) => set("options_considered", e.target.value)} placeholder="Option A&#10;Option B&#10;Option C" />
      </div>
      <div>
        <label className="label">Chosen option *</label>
        <input className="input" value={form.chosen_option} onChange={(e) => set("chosen_option", e.target.value)} placeholder="What did you go with?" required />
      </div>
      <div>
        <label className="label">Reasoning</label>
        <textarea className="input min-h-[72px] resize-none" value={form.reasoning} onChange={(e) => set("reasoning", e.target.value)} placeholder="Why did you choose this option?" />
      </div>
      <div>
        <label className="label">Expected outcome</label>
        <textarea className="input min-h-[60px] resize-none" value={form.expected_outcome} onChange={(e) => set("expected_outcome", e.target.value)} placeholder="What do you expect to happen?" />
      </div>
      <div>
        <label className="label">Tags (comma-separated)</label>
        <input className="input" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="career, health, finance" />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? "Saving…" : initial ? "Update" : "Log Decision"}</button>
      </div>
    </form>
  );
}

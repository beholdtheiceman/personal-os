"use client";
import { useState } from "react";
import { useDecisions } from "@/hooks/useDecisions";
import type { Decision } from "@/types";

interface Props {
  decision: Decision;
  onClose: () => void;
}

export default function DecisionReview({ decision, onClose }: Props) {
  const { updateDecision } = useDecisions();
  const [notes, setNotes] = useState(decision.review_notes ?? "");
  const [rating, setRating] = useState<number>(decision.outcome_rating ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!rating) return;
    setSaving(true);
    await updateDecision(decision.id, {
      review_notes: notes,
      outcome_rating: rating,
      status: "reviewed",
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-text-primary">Review Decision</h3>
        <p className="text-sm text-text-secondary">{decision.title}</p>

        <div>
          <label className="label">How did it go? (1–5)</label>
          <div className="flex gap-2 mt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                className={`w-9 h-9 rounded-lg text-sm font-medium border transition-colors ${
                  rating === n
                    ? "bg-accent text-white border-accent"
                    : "border-bg-border text-text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-1">
            {rating === 1 ? "Poor — much worse than expected" :
             rating === 2 ? "Below expectations" :
             rating === 3 ? "As expected" :
             rating === 4 ? "Better than expected" :
             rating === 5 ? "Excellent — exceeded expectations" : "Select a rating"}
          </p>
        </div>

        <div>
          <label className="label">Review notes</label>
          <textarea
            className="input min-h-[80px] resize-none mt-1"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What actually happened? What would you do differently?"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button onClick={handleSave} disabled={!rating || saving} className="btn-primary text-sm">
            {saving ? "Saving…" : "Save Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

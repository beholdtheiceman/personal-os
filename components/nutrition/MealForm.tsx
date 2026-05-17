"use client";
import { useState } from "react";
import { RiCloseLine, RiSparkling2Line } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import type { MealType } from "@/types";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

interface Props {
  onSave: (meal: MealType, description: string) => Promise<void>;
  onClose: () => void;
}

export default function MealForm({ onSave, onClose }: Props) {
  const [meal, setMeal] = useState<MealType>("breakfast");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await onSave(meal, description.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-bg-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border">
          <h2 className="font-semibold text-text-primary">Log a Meal</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Meal type */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2 block">
              Meal Type
            </label>
            <div className="flex gap-2">
              {MEAL_TYPES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMeal(m)}
                  className={`flex-1 py-2 rounded-lg text-sm capitalize font-medium border transition-all ${
                    meal === m
                      ? "bg-accent/20 border-accent/50 text-accent"
                      : "bg-bg-tertiary border-bg-border text-text-secondary hover:border-accent/30"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-2 block">
              What did you eat?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 2 scrambled eggs, whole wheat toast with butter, black coffee"
              rows={3}
              className="w-full bg-bg-tertiary border border-bg-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/50"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-ghost text-sm flex-1">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!description.trim() || saving}
              className="btn-primary text-sm flex-1 flex items-center justify-center gap-2"
            >
              {saving ? <LoadingDots /> : <><RiSparkling2Line className="w-4 h-4" /> Estimate & Log</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

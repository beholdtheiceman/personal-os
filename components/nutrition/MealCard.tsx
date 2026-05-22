"use client";
import { RiDeleteBinLine } from "react-icons/ri";
import { format } from "date-fns";
import type { NutritionLog } from "@/types";

const MEAL_COLORS: Record<string, string> = {
  breakfast: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  lunch: "text-green-400 bg-green-400/10 border-green-400/20",
  dinner: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  snack: "text-purple-400 bg-purple-400/10 border-purple-400/20",
};

interface Props {
  log: NutritionLog;
  onDelete?: (id: string) => void;
}

export default function MealCard({ log, onDelete }: Props) {
  const colorClass = MEAL_COLORS[log.meal] ?? "text-text-muted bg-bg-tertiary border-bg-border";

  return (
    <div className="card flex items-start gap-4">
      <span className={`shrink-0 px-2 py-1 rounded-lg text-xs font-semibold capitalize border ${colorClass}`}>
        {log.meal}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary">{log.description}</p>
        <div className="flex gap-4 mt-2 text-xs text-text-muted">
          <span><span className="text-text-primary font-medium">{log.calories_estimated}</span> kcal</span>
          <span><span className="text-text-primary font-medium">{log.protein_g}g</span> protein</span>
          <span><span className="text-text-primary font-medium">{log.carbs_g}g</span> carbs</span>
          <span><span className="text-text-primary font-medium">{log.fat_g}g</span> fat</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="text-xs text-text-muted">
          {format(
            typeof log.logged_at === "string"
              ? new Date(log.logged_at)
              : (log.logged_at as { toDate: () => Date }).toDate?.() ?? new Date(),
            "h:mm a"
          )}
        </span>
        {onDelete && (
          <button
            onClick={() => onDelete(log.id)}
            className="text-text-muted hover:text-danger transition-colors"
          >
            <RiDeleteBinLine className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

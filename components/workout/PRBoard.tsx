"use client";
import { RiTrophyLine } from "react-icons/ri";
import { useWorkout } from "@/hooks/useWorkout";
import { format, parseISO } from "date-fns";
import type { ExerciseCategory } from "@/types";

const CATEGORY_ORDER: ExerciseCategory[] = ["push", "pull", "legs", "core", "cardio", "other"];

export default function PRBoard() {
  const { exercises, loading } = useWorkout();

  if (loading) return <div className="py-8 text-center text-text-muted text-sm">Loading…</div>;

  const withPRs = exercises.filter((e) => e.pr_weight !== undefined && e.pr_weight > 0);
  const noPRs = exercises.filter((e) => !e.pr_weight || e.pr_weight === 0);

  if (exercises.length === 0) {
    return <p className="text-sm text-text-muted text-center py-12">No exercises in your library yet. Log a workout to get started.</p>;
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, typeof exercises>>((acc, cat) => {
    const group = withPRs.filter((e) => e.category === cat);
    if (group.length > 0) acc[cat] = group;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, exList]) => (
        <div key={cat} className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide capitalize">{cat}</p>
          <div className="space-y-1">
            {exList.map((ex) => (
              <div key={ex.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-bg-border">
                <RiTrophyLine className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-sm text-text-primary flex-1">{ex.name}</span>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-text-primary">
                    {ex.pr_weight}{" "}
                    <span className="text-xs font-normal text-text-muted">lbs</span>
                    {ex.pr_reps && (
                      <span className="text-xs font-normal text-text-muted ml-1">× {ex.pr_reps}</span>
                    )}
                  </p>
                  {ex.pr_date && (
                    <p className="text-[10px] text-text-muted">{format(parseISO(ex.pr_date), "MMM d, yyyy")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {noPRs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">No PR yet</p>
          <div className="flex flex-wrap gap-2">
            {noPRs.map((ex) => (
              <span key={ex.id} className="text-xs bg-bg-tertiary rounded-lg px-2.5 py-1 text-text-muted capitalize">
                {ex.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

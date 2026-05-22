"use client";
import { useState } from "react";
import { RiRobot2Line, RiDeleteBinLine } from "react-icons/ri";
import { useWorkout } from "@/hooks/useWorkout";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO } from "date-fns";

export default function WorkoutPlanView() {
  const { plans, loading } = useWorkout();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const deletePlan = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "workout_plans", id));
  };

  if (loading) return <div className="py-8 text-center text-text-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-accent/5 border border-accent/20">
        <RiRobot2Line className="w-4 h-4 text-accent mt-0.5 shrink-0" />
        <p className="text-xs text-text-secondary">
          Ask Claude to generate a workout plan: <em>"Create a 3-day strength training plan for a beginner"</em> or <em>"Build me a PPL split for intermediate lifters."</em>
        </p>
      </div>

      {plans.length === 0 && (
        <p className="text-sm text-text-muted text-center py-8">No plans yet. Ask Claude to generate one!</p>
      )}

      {plans.map((plan) => (
        <div key={plan.id} className="border border-bg-border rounded-xl overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === plan.id ? null : plan.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{plan.name}</p>
              <p className="text-xs text-text-muted">
                {plan.days.length} days · Created {format(parseISO(plan.created_at), "MMM d, yyyy")}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deletePlan(plan.id); }}
              className="text-text-muted hover:text-red-400 p-1"
            >
              <RiDeleteBinLine className="w-3.5 h-3.5" />
            </button>
          </button>

          {expanded === plan.id && (
            <div className="border-t border-bg-border divide-y divide-bg-border">
              {plan.days.map((day, i) => (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-accent">{day.day}</span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs font-medium text-text-secondary">{day.focus}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {day.exercises.map((ex, j) => (
                      <li key={j} className="text-xs text-text-secondary flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-text-muted inline-block shrink-0" />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

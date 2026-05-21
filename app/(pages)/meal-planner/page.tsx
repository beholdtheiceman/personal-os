"use client";
import { useState } from "react";
import { format, startOfWeek, addWeeks, subWeeks, parseISO } from "date-fns";
import { RiArrowLeftLine, RiArrowRightLine } from "react-icons/ri";
import WeeklyPlanner from "@/components/meal-planner/WeeklyPlanner";
import RecipeLibrary from "@/components/meal-planner/RecipeLibrary";
import ShoppingListView from "@/components/meal-planner/ShoppingListView";

type Tab = "planner" | "recipes" | "shopping";

function getWeekStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export default function MealPlannerPage() {
  const [tab, setTab]             = useState<Tab>("planner");
  const [weekOffset, setWeekOffset] = useState(0);

  const currentWeekStart = getWeekStart(addWeeks(new Date(), weekOffset));
  const weekLabel = (() => {
    const start = parseISO(currentWeekStart);
    const end   = addWeeks(start, 1);
    if (weekOffset === 0) return "This week";
    if (weekOffset === 1) return "Next week";
    if (weekOffset === -1) return "Last week";
    return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
  })();

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Meal Planner</h1>
        <p className="text-text-secondary text-sm">Plan your week, manage recipes, and generate shopping lists.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-bg-tertiary rounded-xl w-fit border border-white/[0.12]">
        {([
          { key: "planner",  label: "This Week" },
          { key: "recipes",  label: "Recipes"   },
          { key: "shopping", label: "Shopping"  },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-accent/40 text-white shadow-sm"
                : "bg-white/[0.12] text-text-secondary hover:bg-white/[0.20] hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Week nav — only shown on planner + shopping tabs */}
      {(tab === "planner" || tab === "shopping") && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors"
          >
            <RiArrowLeftLine className="w-4 h-4" />
          </button>
          <p className="text-sm font-medium text-text-primary min-w-[120px] text-center">{weekLabel}</p>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors"
          >
            <RiArrowRightLine className="w-4 h-4" />
          </button>
          {weekOffset !== 0 && (
            <button onClick={() => setWeekOffset(0)} className="text-xs text-accent hover:text-accent/80 transition-colors">
              Today
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {tab === "planner"  && <WeeklyPlanner weekStart={currentWeekStart} />}
      {tab === "recipes"  && <RecipeLibrary />}
      {tab === "shopping" && <ShoppingListView weekStart={currentWeekStart} />}
    </div>
  );
}

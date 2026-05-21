"use client";
import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useMealPlan, useRecipes } from "@/hooks/useMealPlanner";
import { format, addDays, parseISO } from "date-fns";
import { RiAddLine, RiCloseLine, RiSearchLine } from "react-icons/ri";
import type { MealSlot, MealPlanDay, Recipe } from "@/types";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
const SLOT_LABELS: Record<MealSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

interface Props {
  weekStart: string; // YYYY-MM-DD (Monday)
}

interface PickerState { date: string; slot: MealSlot }

export default function WeeklyPlanner({ weekStart }: Props) {
  const { user } = useAuth();
  const { plan, loading } = useMealPlan(weekStart);
  const { recipes } = useRecipes();
  const [picker, setPicker]   = useState<PickerState | null>(null);
  const [search, setSearch]   = useState("");

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(weekStart), i), "yyyy-MM-dd")
  );

  const getEntry = (date: string, slot: MealSlot) =>
    plan?.days?.[date]?.[slot] ?? null;

  const assignMeal = async (date: string, slot: MealSlot, recipe: Recipe) => {
    if (!user) return;
    const planRef = doc(db, "users", user.uid, "meal_plans", weekStart);
    const existingDays = plan?.days ?? {};
    const updatedDays = {
      ...existingDays,
      [date]: {
        ...(existingDays[date] ?? {}),
        [slot]: { recipe_id: recipe.id, recipe_name: recipe.name, servings: 1 },
      },
    };
    await setDoc(planRef, { week_start: weekStart, days: updatedDays, created_at: plan?.created_at ?? new Date().toISOString() });
    setPicker(null);
    setSearch("");
  };

  const clearMeal = async (date: string, slot: MealSlot) => {
    if (!user) return;
    const planRef = doc(db, "users", user.uid, "meal_plans", weekStart);
    const existingDays = { ...(plan?.days ?? {}) };
    if (existingDays[date]) {
      const day = { ...existingDays[date] };
      delete day[slot];
      existingDays[date] = day;
    }
    await setDoc(planRef, { week_start: weekStart, days: existingDays, created_at: plan?.created_at ?? new Date().toISOString() });
  };

  const filteredRecipes = recipes.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-3">
      {/* Scrollable grid */}
      <div
        className="overflow-x-auto rounded-2xl p-4"
        style={{ background: "rgba(18, 7, 15, 0.82)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        <div className="min-w-[640px]">
          {/* Day headers */}
          <div className="grid gap-1.5 mb-2" style={{ gridTemplateColumns: "76px repeat(7, 1fr)" }}>
            <div />
            {weekDays.map((date) => {
              const isToday = date === format(new Date(), "yyyy-MM-dd");
              return (
                <div key={date} className={`text-center py-1 rounded-lg ${isToday ? "bg-accent/20" : ""}`}>
                  <p className={`text-xs font-semibold ${isToday ? "text-accent" : "text-text-primary"}`}>
                    {format(parseISO(date), "EEE")}
                  </p>
                  <p className={`text-[10px] ${isToday ? "text-accent/80" : "text-text-secondary"}`}>
                    {format(parseISO(date), "M/d")}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Meal rows */}
          {SLOTS.map((slot) => (
            <div key={slot} className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: "76px repeat(7, 1fr)" }}>
              {/* Row label */}
              <div className="flex items-center pr-2">
                <span className="text-xs font-semibold text-text-secondary">{SLOT_LABELS[slot]}</span>
              </div>
              {/* Cells */}
              {weekDays.map((date) => {
                const entry = getEntry(date, slot);
                return (
                  <div key={date} className="min-h-[52px]">
                    {entry ? (
                      <div
                        className="h-full rounded-lg px-2 py-1.5 flex flex-col justify-between group min-h-[52px]"
                        style={{ background: "rgba(196,114,138,0.22)", border: "1px solid rgba(196,114,138,0.45)" }}
                      >
                        <p className="text-xs font-medium text-white leading-tight line-clamp-2">{entry.recipe_name}</p>
                        <button
                          onClick={() => clearMeal(date, slot)}
                          className="self-end opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-danger"
                        >
                          <RiCloseLine className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setPicker({ date, slot }); setSearch(""); }}
                        className="w-full h-full min-h-[52px] rounded-lg flex items-center justify-center transition-colors group"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.20)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      >
                        <RiAddLine className="w-4 h-4 text-text-secondary opacity-50 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Recipe picker modal */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPicker(null)} />
          <div
            className="relative w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: "rgba(20, 8, 18, 0.96)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Pick a recipe</h3>
                <p className="text-xs text-text-muted">
                  {format(parseISO(picker.date), "EEE, MMM d")} · {SLOT_LABELS[picker.slot]}
                </p>
              </div>
              <button onClick={() => setPicker(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors">
                <RiCloseLine className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                autoFocus
                className="input-base w-full pl-9 text-sm"
                placeholder="Search recipes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredRecipes.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-6">
                  {recipes.length === 0 ? "No recipes yet — add some in the Recipes tab." : "No matches."}
                </p>
              ) : (
                filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => assignMeal(picker.date, picker.slot, recipe)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-white/[0.08] transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-primary">{recipe.name}</p>
                      <p className="text-xs text-text-muted">
                        {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
                        {recipe.calories_per_serving ? ` · ${recipe.calories_per_serving} kcal` : ""}
                      </p>
                    </div>
                    <RiAddLine className="w-4 h-4 text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, orderBy, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import MealForm from "./MealForm";
import MealCard from "./MealCard";
import { RiAddLine, RiBowlLine, RiArrowLeftLine, RiArrowRightLine } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import { useToday } from "@/hooks/useToday";
import toast from "react-hot-toast";
import { format, parseISO, startOfWeek, addDays, subDays } from "date-fns";
import type { NutritionLog, MealType } from "@/types";

const GOALS = { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 65 };

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-medium">{value} / {goal}{label === "Calories" ? "" : "g"}</span>
      </div>
      <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color} ${pct >= 100 ? "opacity-70" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function NutritionTracker() {
  const { user } = useAuth();
  const [allLogs, setAllLogs] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");
  const today = useToday();
  const [selectedDate, setSelectedDate] = useState(today);

  // Keep selectedDate in sync if today rolls over midnight
  useEffect(() => { setSelectedDate(today); }, [today]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "nutrition"),
      orderBy("logged_at", "desc"),
      limit(200)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAllLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NutritionLog)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // Daily: logs for selected date
  const dayLogs = useMemo(
    () => allLogs.filter((l) => l.date === selectedDate).slice().reverse(),
    [allLogs, selectedDate]
  );

  const dayTotals = useMemo(() => dayLogs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.calories_estimated,
      protein_g: acc.protein_g + l.protein_g,
      carbs_g: acc.carbs_g + l.carbs_g,
      fat_g: acc.fat_g + l.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  ), [dayLogs]);

  // Weekly: Mon–Sun of the week containing today
  const weekDays = useMemo(() => {
    const monday = startOfWeek(parseISO(today), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), "yyyy-MM-dd"));
  }, [today]);

  const weekData = useMemo(() => weekDays.map((date) => {
    const logs = allLogs.filter((l) => l.date === date);
    return {
      date,
      label: format(parseISO(date), "EEE"),
      shortDate: format(parseISO(date), "M/d"),
      calories: logs.reduce((s, l) => s + l.calories_estimated, 0),
      protein: logs.reduce((s, l) => s + l.protein_g, 0),
    };
  }), [allLogs, weekDays]);

  const maxCalories = Math.max(GOALS.calories, ...weekData.map((d) => d.calories));

  const handleSave = async (meal: MealType, description: string) => {
    if (!user) return;
    setShowForm(false);
    try {
      const res = await fetch("/api/nutrition/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, meal }),
      });
      const estimate = await res.json();
      if (estimate.error) throw new Error(estimate.error);

      await addDoc(collection(db, "users", user.uid, "nutrition"), {
        date: today,
        meal,
        description,
        calories_estimated: estimate.calories_estimated ?? 0,
        protein_g: estimate.protein_g ?? 0,
        carbs_g: estimate.carbs_g ?? 0,
        fat_g: estimate.fat_g ?? 0,
        logged_at: new Date().toISOString(),
      });
      toast.success("Meal logged");
    } catch {
      toast.error("Failed to log meal");
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "nutrition", id));
    toast.success("Meal removed");
  };

  const isToday = selectedDate === today;
  const isFuture = selectedDate > today;

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-bg-tertiary rounded-xl w-fit">
        {(["daily", "weekly"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? "bg-accent/25 text-accent shadow-sm"
                : "bg-white/8 text-text-secondary hover:bg-white/12 hover:text-text-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Daily Tab ── */}
      {activeTab === "daily" && (
        <>
          {/* Date nav */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors"
              >
                <RiArrowLeftLine className="w-4 h-4" />
              </button>
              <p className="text-sm font-medium text-text-primary min-w-[140px] text-center">
                {isToday ? "Today" : format(parseISO(selectedDate), "EEEE, MMM d")}
              </p>
              <button
                onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
                disabled={isToday}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-tertiary text-text-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <RiArrowRightLine className="w-4 h-4" />
              </button>
            </div>

            {isToday && (
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <RiAddLine className="w-4 h-4" /> Log Meal
              </button>
            )}
          </div>

          {/* Macro summary */}
          <div className="card space-y-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              {isToday ? "Today's Totals" : "Day Totals"}
            </h2>
            <MacroBar label="Calories" value={dayTotals.calories} goal={GOALS.calories} color="bg-amber-400" />
            <MacroBar label="Protein" value={dayTotals.protein_g} goal={GOALS.protein_g} color="bg-blue-400" />
            <MacroBar label="Carbs" value={dayTotals.carbs_g} goal={GOALS.carbs_g} color="bg-green-400" />
            <MacroBar label="Fat" value={dayTotals.fat_g} goal={GOALS.fat_g} color="bg-purple-400" />
          </div>

          {/* Meal list */}
          {loading ? (
            <div className="flex justify-center py-12"><LoadingDots /></div>
          ) : dayLogs.length === 0 ? (
            <div className="card flex flex-col items-center py-12 text-center">
              <RiBowlLine className="w-10 h-10 text-text-muted mb-3" />
              <p className="text-text-secondary text-sm mb-3">
                {isFuture ? "No meals logged for this day." : isToday ? "No meals logged today." : "No meals logged for this day."}
              </p>
              {isToday && (
                <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
                  Log your first meal
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {dayLogs.map((log) => (
                <MealCard key={log.id} log={log} onDelete={isToday ? handleDelete : undefined} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Weekly Tab ── */}
      {activeTab === "weekly" && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              This Week — Calories
            </h2>
            <span className="text-xs text-text-muted">Goal: {GOALS.calories} kcal/day</span>
          </div>

          {/* Bar chart */}
          <div className="flex items-end gap-2 h-32">
            {weekData.map((day) => {
              const heightPct = day.calories > 0 ? Math.min(100, (day.calories / maxCalories) * 100) : 0;
              const isSelected = day.date === today;
              const overGoal = day.calories > GOALS.calories;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-text-muted">
                    {day.calories > 0 ? day.calories : ""}
                  </span>
                  <div className="w-full flex items-end" style={{ height: "80px" }}>
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        overGoal ? "bg-warning/70" : isSelected ? "bg-accent" : "bg-accent/40"
                      }`}
                      style={{ height: `${heightPct}%`, minHeight: day.calories > 0 ? "4px" : "0" }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${isSelected ? "text-accent" : "text-text-secondary"}`}>
                    {day.label}
                  </span>
                  <span className="text-[10px] text-text-muted">{day.shortDate}</span>
                </div>
              );
            })}
          </div>

          {/* Goal line indicator */}
          <p className="text-xs text-text-muted text-center">
            Bars turn orange when over the {GOALS.calories} kcal daily goal
          </p>

          {/* Weekly totals */}
          <div className="border-t border-bg-border pt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-semibold text-text-primary">
                {weekData.reduce((s, d) => s + d.calories, 0).toLocaleString()}
              </p>
              <p className="text-xs text-text-muted">kcal this week</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-text-primary">
                {Math.round(weekData.filter((d) => d.calories > 0).reduce((s, d) => s + d.calories, 0) /
                  Math.max(1, weekData.filter((d) => d.calories > 0).length))}
              </p>
              <p className="text-xs text-text-muted">avg kcal/day</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-text-primary">
                {weekData.reduce((s, d) => s + d.protein, 0)}g
              </p>
              <p className="text-xs text-text-muted">protein this week</p>
            </div>
          </div>
        </div>
      )}

      {showForm && <MealForm onSave={handleSave} onClose={() => setShowForm(false)} />}
    </div>
  );
}

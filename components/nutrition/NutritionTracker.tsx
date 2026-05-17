"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, orderBy, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import MealForm from "./MealForm";
import MealCard from "./MealCard";
import { RiAddLine, RiBowlLine } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import toast from "react-hot-toast";
import { format } from "date-fns";
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
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "nutrition"),
      orderBy("logged_at", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as NutritionLog));
      setLogs(all.filter((l) => l.date === today).reverse());
      setLoading(false);
    });
    return unsub;
  }, [user, today]);

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

  const totals = logs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.calories_estimated,
      protein_g: acc.protein_g + l.protein_g,
      carbs_g: acc.carbs_g + l.carbs_g,
      fat_g: acc.fat_g + l.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">{format(new Date(), "EEEE, MMMM d")}</p>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <RiAddLine className="w-4 h-4" /> Log Meal
        </button>
      </div>

      {/* Macro summary */}
      <div className="card space-y-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Today's Totals</h2>
        <MacroBar label="Calories" value={totals.calories} goal={GOALS.calories} color="bg-amber-400" />
        <MacroBar label="Protein" value={totals.protein_g} goal={GOALS.protein_g} color="bg-blue-400" />
        <MacroBar label="Carbs" value={totals.carbs_g} goal={GOALS.carbs_g} color="bg-green-400" />
        <MacroBar label="Fat" value={totals.fat_g} goal={GOALS.fat_g} color="bg-purple-400" />
      </div>

      {/* Meal list */}
      {loading ? (
        <div className="flex justify-center py-12"><LoadingDots /></div>
      ) : logs.length === 0 ? (
        <div className="card flex flex-col items-center py-12 text-center">
          <RiBowlLine className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary text-sm mb-3">No meals logged today.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
            Log your first meal
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <MealCard key={log.id} log={log} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showForm && <MealForm onSave={handleSave} onClose={() => setShowForm(false)} />}
    </div>
  );
}

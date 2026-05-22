"use client";
import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useXP } from "@/hooks/useXP";
import { awardXP } from "@/lib/awardXP";
import { format } from "date-fns";
import toast from "react-hot-toast";
import type { Exercise, WorkoutSession, WorkoutExercise, ExerciseCategory } from "@/types";

export function useWorkout() {
  const { user } = useAuth();
  const { totalXP } = useXP();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "workouts"), orderBy("date", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkoutSession)));
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "exercises"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      setExercises(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Exercise)));
    });
  }, [user]);

  const addExercise = useCallback(
    async (name: string, category: ExerciseCategory = "other"): Promise<Exercise> => {
      if (!user) throw new Error("Not authenticated");
      const existing = exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing;
      const now = new Date().toISOString();
      const ref = await addDoc(collection(db, "users", user.uid, "exercises"), {
        name, category, created_at: now,
      });
      return { id: ref.id, name, category, created_at: now };
    },
    [user, exercises]
  );

  const saveSession = useCallback(
    async (
      name: string,
      workoutExercises: WorkoutExercise[],
      duration_min?: number,
      notes?: string
    ) => {
      if (!user) return;
      const today = format(new Date(), "yyyy-MM-dd");
      const now = new Date().toISOString();

      // PR detection: for each exercise find max weight in this session
      const newPRs: string[] = [];
      for (const we of workoutExercises) {
        if (we.sets.length === 0) continue;
        const maxSet = we.sets.reduce((best, s) => (s.weight > best.weight ? s : best), we.sets[0]);
        const exercise = exercises.find((e) => e.id === we.exercise_id);
        if (!exercise) continue;
        const oldPR = exercise.pr_weight ?? 0;
        if (maxSet.weight > oldPR) {
          newPRs.push(`${we.exercise_name}: ${maxSet.weight}${maxSet.unit}`);
          await updateDoc(doc(db, "users", user.uid, "exercises", we.exercise_id), {
            pr_weight: maxSet.weight,
            pr_reps: maxSet.reps,
            pr_date: today,
          });
        }
      }

      // Save session
      await addDoc(collection(db, "users", user.uid, "workouts"), {
        date: today,
        name,
        exercises: workoutExercises,
        duration_min: duration_min ?? null,
        notes: notes ?? "",
        created_at: now,
      });

      // XP: 50 base + 10 per exercise
      const xp = 50 + workoutExercises.length * 10;
      await awardXP(user.uid, xp, "workout_complete", `Workout: ${name} (${workoutExercises.length} exercises)`, totalXP);

      // Toasts
      if (newPRs.length > 0) {
        toast.success(`🏆 New PR${newPRs.length > 1 ? "s" : ""}! ${newPRs.join(", ")}`, { duration: 5000 });
      }
      toast.success(`+${xp} XP — workout logged!`);
    },
    [user, exercises, totalXP]
  );

  const savePlan = useCallback(
    async (name: string, days: { day: string; focus: string; exercises: string[] }[]) => {
      if (!user) return;
      await addDoc(collection(db, "users", user.uid, "workout_plans"), {
        name, days, created_at: new Date().toISOString(),
      });
    },
    [user]
  );

  // Load plans separately
  const [plans, setPlans] = useState<{ id: string; name: string; days: { day: string; focus: string; exercises: string[] }[]; created_at: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "workout_plans"), orderBy("created_at", "desc"), limit(10));
    return onSnapshot(q, (snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() } as typeof plans[number])));
    });
  }, [user]);

  return { sessions, exercises, plans, loading, addExercise, saveSession, savePlan };
}

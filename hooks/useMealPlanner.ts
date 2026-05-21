"use client";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Recipe, MealPlan, ShoppingList } from "@/types";

export function useRecipes() {
  const { user } = useAuth();
  const [recipes, setRecipes]   = useState<Recipe[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "recipes"), orderBy("created_at", "desc"));
    return onSnapshot(q, (snap) => {
      setRecipes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Recipe)));
      setLoading(false);
    });
  }, [user]);

  return { recipes, loading };
}

export function useMealPlan(weekStart: string) {
  const { user } = useAuth();
  const [plan, setPlan]       = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !weekStart) return;
    return onSnapshot(doc(db, "users", user.uid, "meal_plans", weekStart), (snap) => {
      setPlan(snap.exists() ? ({ id: snap.id, ...snap.data() } as MealPlan) : null);
      setLoading(false);
    });
  }, [user, weekStart]);

  return { plan, loading };
}

export function useShoppingList(weekStart: string) {
  const { user } = useAuth();
  const [list, setList]       = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !weekStart) return;
    return onSnapshot(doc(db, "users", user.uid, "shopping_lists", weekStart), (snap) => {
      setList(snap.exists() ? ({ id: snap.id, ...snap.data() } as ShoppingList) : null);
      setLoading(false);
    });
  }, [user, weekStart]);

  return { list, loading };
}

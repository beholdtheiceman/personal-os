"use client";
import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import type { Decision, DecisionStatus } from "@/types";

export function useDecisions() {
  const { user } = useAuth();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "decisions"),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      setDecisions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Decision)));
      setLoading(false);
    });
  }, [user]);

  const today = format(new Date(), "yyyy-MM-dd");

  const addDecision = useCallback(
    async (data: Omit<Decision, "id" | "created_at" | "updated_at" | "status">) => {
      if (!user) return;
      const now = new Date().toISOString();
      await addDoc(collection(db, "users", user.uid, "decisions"), {
        ...data,
        status: "pending_review" as DecisionStatus,
        created_at: now,
        updated_at: now,
      });
    },
    [user]
  );

  const updateDecision = useCallback(
    async (id: string, patch: Partial<Omit<Decision, "id" | "created_at">>) => {
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid, "decisions", id), {
        ...patch,
        updated_at: new Date().toISOString(),
      });
    },
    [user]
  );

  const deleteDecision = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, "users", user.uid, "decisions", id));
    },
    [user]
  );

  const pendingReview = decisions.filter(
    (d) => d.status === "pending_review" && d.review_date <= today
  );
  const active = decisions.filter((d) => d.status === "pending_review" && d.review_date > today);
  const reviewed = decisions.filter((d) => d.status === "reviewed");

  return { decisions, active, pendingReview, reviewed, loading, addDecision, updateDecision, deleteDecision };
}

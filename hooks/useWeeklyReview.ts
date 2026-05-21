"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface WeeklyReview {
  week_start: string;
  content: string;
  generated_at: string;
  last_error?: string;
  last_error_at?: string;
}

export function useWeeklyReview() {
  const { user } = useAuth();
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, "users", user.uid, "weekly_reviews", "latest"),
      (snap) => {
        setReview(snap.exists() ? (snap.data() as WeeklyReview) : null);
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  return { review, loading };
}

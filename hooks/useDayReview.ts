"use client";
import { useState, useEffect, useCallback } from "react";
import { doc, collection, onSnapshot, setDoc, query, orderBy, limit, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { awardXP } from "@/lib/awardXP";
import { format, subDays } from "date-fns";
import type { DayReview } from "@/types";

export function useDayReview() {
  const { user } = useAuth();
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [todayReview, setTodayReview] = useState<DayReview | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  // Today's review doc
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, `users/${user.uid}/day_reviews/${todayStr}`), (snap) => {
      setTodayReview(snap.exists() ? (snap.data() as DayReview) : null);
      setLoading(false);
    });
  }, [user, todayStr]);

  // Last 30 days for streak computation
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, `users/${user.uid}/day_reviews`), orderBy("date", "desc"), limit(31)),
      (snap) => {
        const dates = new Set(snap.docs.map((d) => d.id));
        let s = 0;
        for (let i = 0; i < 30; i++) {
          if (dates.has(format(subDays(new Date(), i), "yyyy-MM-dd"))) s++;
          else break;
        }
        setStreak(s);
      }
    );
  }, [user]);

  const submitReview = useCallback(async (q1: string, q2: string, q3: string) => {
    if (!user) return;
    const isFirst = !todayReview;
    const data: DayReview = { date: todayStr, q1, q2, q3, created_at: new Date().toISOString() };
    await setDoc(doc(db, `users/${user.uid}/day_reviews/${todayStr}`), data);
    if (isFirst) {
      const xpSnap = await getDoc(doc(db, `users/${user.uid}/xp/summary`));
      await awardXP(user.uid, 10, "day_review_complete", "Day review completed", (xpSnap.data()?.total as number) ?? 0);
    }
  }, [user, todayStr, todayReview]);

  return { todayReview, streak, loading, submitReview };
}

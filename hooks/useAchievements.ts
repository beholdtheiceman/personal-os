"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { TOTAL_GAMERSCORE } from "@/lib/achievements";
import type { AchievementUnlock } from "@/types";

export function useAchievements() {
  const { user } = useAuth();
  const [unlocks, setUnlocks] = useState<AchievementUnlock[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(
        collection(db, `users/${user.uid}/achievements`),
        orderBy("unlockedAt", "desc")
      ),
      (snap) => {
        setUnlocks(snap.docs.map((d) => d.data() as AchievementUnlock));
        setLoaded(true);
      }
    );
  }, [user]);

  const totalGamerscore = unlocks.reduce((sum, u) => sum + u.gamerscore, 0);
  const maxGamerscore = TOTAL_GAMERSCORE;

  return { unlocks, totalGamerscore, maxGamerscore, loaded };
}

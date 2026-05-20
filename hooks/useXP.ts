"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getLevelInfo } from "@/lib/xp";
import type { LevelInfo } from "@/lib/xp";
import type { XPEvent } from "@/types";

export function useXP() {
  const { user } = useAuth();
  const [totalXP, setTotalXP] = useState(0);
  const [levelInfo, setLevelInfo] = useState<LevelInfo>(getLevelInfo(0));
  const [recentEvents, setRecentEvents] = useState<XPEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubXP = onSnapshot(doc(db, `users/${user.uid}/xp/summary`), (snap) => {
      const total = (snap.data()?.total as number) ?? 0;
      setTotalXP(total);
      setLevelInfo(getLevelInfo(total));
      setLoaded(true);
    });

    const unsubEvents = onSnapshot(
      query(
        collection(db, `users/${user.uid}/xp_events`),
        orderBy("timestamp", "desc"),
        limit(5)
      ),
      (snap) => {
        setRecentEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as XPEvent)));
      }
    );

    return () => { unsubXP(); unsubEvents(); };
  }, [user]);

  return { totalXP, levelInfo, recentEvents, loaded };
}

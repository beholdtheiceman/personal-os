"use client";
import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, setDoc, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Supplement, SupplementLog } from "@/types";

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

export function useSupplements() {
  const { user } = useAuth();
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [todayLog,    setTodayLog]    = useState<SupplementLog | null>(null);
  const [loading,     setLoading]     = useState(true);

  // Live list of supplement definitions
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/supplements`),
      orderBy("created_at", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setSupplements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Supplement)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  // Live today's log
  useEffect(() => {
    if (!user) return;
    const date = todayStr();
    const unsub = onSnapshot(
      doc(db, `users/${user.uid}/supplement_logs/${date}`),
      (snap) => {
        if (snap.exists()) {
          setTodayLog(snap.data() as SupplementLog);
        } else {
          setTodayLog({ date, taken: [], logged_at: "" });
        }
      }
    );
    return unsub;
  }, [user]);

  // CRUD for supplement definitions
  const addSupplement = useCallback(
    async (data: Omit<Supplement, "id" | "created_at" | "updated_at">) => {
      if (!user) return;
      const now = new Date().toISOString();
      await addDoc(collection(db, `users/${user.uid}/supplements`), {
        ...data,
        created_at: now,
        updated_at: now,
      });
    },
    [user]
  );

  const updateSupplement = useCallback(
    async (id: string, data: Partial<Supplement>) => {
      if (!user) return;
      await updateDoc(doc(db, `users/${user.uid}/supplements/${id}`), {
        ...data,
        updated_at: new Date().toISOString(),
      });
    },
    [user]
  );

  const deleteSupplement = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, `users/${user.uid}/supplements/${id}`));
    },
    [user]
  );

  // Toggle a supplement as taken/not-taken today
  const toggleTaken = useCallback(
    async (supplementId: string) => {
      if (!user) return;
      const date = todayStr();
      const ref = doc(db, `users/${user.uid}/supplement_logs/${date}`);
      const snap = await getDoc(ref);
      const current: string[] = snap.exists() ? (snap.data().taken as string[]) : [];
      const updated = current.includes(supplementId)
        ? current.filter((id) => id !== supplementId)
        : [...current, supplementId];
      await setDoc(ref, { date, taken: updated, logged_at: new Date().toISOString() }, { merge: true });
    },
    [user]
  );

  const active = supplements.filter((s) => s.active);
  const takenIds = new Set(todayLog?.taken ?? []);

  // Count how many active supplements have been taken today
  const takenCount   = active.filter((s) => takenIds.has(s.id)).length;
  const totalActive  = active.length;
  const allTaken     = totalActive > 0 && takenCount === totalActive;

  return {
    supplements,
    active,
    todayLog,
    loading,
    takenIds,
    takenCount,
    totalActive,
    allTaken,
    addSupplement,
    updateSupplement,
    deleteSupplement,
    toggleTaken,
  };
}

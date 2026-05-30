"use client";
import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Debt } from "@/types";

export function useDebts() {
  const { user } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/debts`),
      orderBy("created_at", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setDebts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Debt)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const addDebt = useCallback(
    async (data: Omit<Debt, "id" | "created_at" | "updated_at">) => {
      if (!user) return;
      const now = new Date().toISOString();
      await addDoc(collection(db, `users/${user.uid}/debts`), {
        ...data,
        created_at: now,
        updated_at: now,
      });
    },
    [user]
  );

  const updateDebt = useCallback(
    async (id: string, updates: Partial<Debt>) => {
      if (!user) return;
      await updateDoc(doc(db, `users/${user.uid}/debts/${id}`), {
        ...updates,
        updated_at: new Date().toISOString(),
      });
    },
    [user]
  );

  const deleteDebt = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, `users/${user.uid}/debts/${id}`));
    },
    [user]
  );

  return { debts, loading, addDebt, updateDebt, deleteDebt };
}

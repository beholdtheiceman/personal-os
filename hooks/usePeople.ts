"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Person, Interaction } from "@/types";

export function usePeople() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "people"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      setPeople(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Person)));
      setLoading(false);
    });
  }, [user]);

  return { people, loading };
}

export function useInteractions(personId: string | null) {
  const { user } = useAuth();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !personId) { setLoading(false); return; }
    const q = query(
      collection(db, "users", user.uid, "people", personId, "interactions"),
      orderBy("date", "desc")
    );
    return onSnapshot(q, (snap) => {
      setInteractions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Interaction)));
      setLoading(false);
    });
  }, [user, personId]);

  return { interactions, loading };
}

// Days since a date string (YYYY-MM-DD), or null
export function daysSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr + "T12:00:00Z").getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Is this person overdue for contact?
export function isOverdue(person: Person): boolean {
  if (!person.contact_frequency || !person.last_contacted) return false;
  const days = daysSince(person.last_contacted) ?? 0;
  const thresholds: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };
  return days > thresholds[person.contact_frequency];
}

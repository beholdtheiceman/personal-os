"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { GmailAgentRun } from "@/types";

export function useEmailAgentStatus() {
  const { user } = useAuth();
  const [status, setStatus]   = useState<GmailAgentRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, `users/${user.uid}/agent_runs/gmail`), (snap) => {
      setStatus(snap.exists() ? (snap.data() as GmailAgentRun) : null);
      setLoading(false);
    });
  }, [user]);

  return { status, loading };
}

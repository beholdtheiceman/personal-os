"use client";
import { useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Idea, IdeaDomain, IdeaStatus } from "@/types";

export function useIdeas() {
  const { user } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/ideas`),
      orderBy("created_at", "desc"),
    );
    return onSnapshot(q, (snap) => {
      setIdeas(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Idea)));
      setLoading(false);
    });
  }, [user]);

  async function addIdea(text: string, domain: IdeaDomain = "other", tags: string[] = []) {
    if (!user) return;
    const now = new Date().toISOString();
    await addDoc(collection(db, `users/${user.uid}/ideas`), {
      text: text.trim(),
      domain,
      tags,
      status: "raw" as IdeaStatus,
      triage_count: 0,
      created_at: now,
      updated_at: now,
    });
  }

  async function updateIdea(id: string, patch: Partial<Omit<Idea, "id" | "created_at">>) {
    if (!user) return;
    await updateDoc(doc(db, `users/${user.uid}/ideas/${id}`), {
      ...patch,
      updated_at: new Date().toISOString(),
    });
  }

  async function deleteIdea(id: string) {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/ideas/${id}`));
  }

  async function promoteToProject(id: string, projectName: string) {
    if (!user) return;
    const projRef = await addDoc(collection(db, `users/${user.uid}/projects`), {
      name: projectName,
      description: "",
      color_tag: "#C4728A",
      status: "active",
      cards: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await updateIdea(id, {
      status: "promoted",
      promoted_to: "project",
      promoted_id: projRef.id,
    });
    return projRef.id;
  }

  const raw = ideas.filter((i) => i.status === "raw");
  const active = ideas.filter((i) => i.status !== "discarded");

  return { ideas, raw, active, loading, addIdea, updateIdea, deleteIdea, promoteToProject };
}

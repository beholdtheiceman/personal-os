"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { QuickLink } from "@/types";

const DOC_PATH = (uid: string) => `users/${uid}/settings/quick_links`;

export function useQuickLinks() {
  const { user } = useAuth();
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, DOC_PATH(user.uid)), (snap) => {
      setLinks(snap.exists() ? (snap.data().links as QuickLink[]) ?? [] : []);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const save = async (updated: QuickLink[]) => {
    if (!user) return;
    // Firestore rejects undefined values — strip optional fields when absent
    const clean = updated.map((l) => {
      const obj: Record<string, unknown> = { id: l.id, title: l.title, url: l.url };
      if (l.emoji) obj.emoji = l.emoji;
      return obj;
    });
    await setDoc(doc(db, DOC_PATH(user.uid)), { links: clean });
  };

  const addLink = (link: Omit<QuickLink, "id">) =>
    save([...links, { ...link, id: crypto.randomUUID() }]);

  const removeLink = (id: string) =>
    save(links.filter((l) => l.id !== id));

  const reorderLinks = (reordered: QuickLink[]) => save(reordered);

  return { links, loading, addLink, removeLink, reorderLinks };
}

"use client";
import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { PodcastEpisode, EpisodeStatus } from "@/types";

const STATUS_ORDER: EpisodeStatus[] = ["idea", "outlined", "recorded", "edited", "published"];

export function usePodcast() {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/podcast_episodes`),
      orderBy("created_at", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setEpisodes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PodcastEpisode)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const addEpisode = useCallback(
    async (data: Omit<PodcastEpisode, "id" | "created_at" | "updated_at">) => {
      if (!user) return;
      const now = new Date().toISOString();
      await addDoc(collection(db, `users/${user.uid}/podcast_episodes`), {
        ...data,
        highlights: [],
        created_at: now,
        updated_at: now,
      });
    },
    [user]
  );

  const updateEpisode = useCallback(
    async (id: string, data: Partial<PodcastEpisode>) => {
      if (!user) return;
      await updateDoc(doc(db, `users/${user.uid}/podcast_episodes/${id}`), {
        ...data,
        updated_at: new Date().toISOString(),
      });
    },
    [user]
  );

  const advanceStatus = useCallback(
    async (episode: PodcastEpisode) => {
      if (!user) return;
      const idx = STATUS_ORDER.indexOf(episode.status);
      if (idx < STATUS_ORDER.length - 1) {
        await updateEpisode(episode.id, { status: STATUS_ORDER[idx + 1] });
      }
    },
    [user, updateEpisode]
  );

  const deleteEpisode = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, `users/${user.uid}/podcast_episodes/${id}`));
    },
    [user]
  );

  // Pipeline grouped by status
  const pipeline = STATUS_ORDER.reduce<Record<EpisodeStatus, PodcastEpisode[]>>(
    (acc, s) => ({ ...acc, [s]: episodes.filter((e) => e.status === s) }),
    {} as Record<EpisodeStatus, PodcastEpisode[]>
  );

  return { episodes, pipeline, loading, addEpisode, updateEpisode, advanceStatus, deleteEpisode };
}

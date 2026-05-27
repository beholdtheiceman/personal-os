"use client";
import { useEffect, useState, useCallback } from 'react';
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { WatchlistItem } from '@/types';

export function useWatchlist() {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, 'users', user.uid, 'watchlist'),
      (snap) => {
        setWatchlist(snap.docs.map(d => ({ id: d.id, ...d.data() } as WatchlistItem)));
        setLoading(false);
      }
    );
  }, [user]);

  const isOnWatchlist = useCallback(
    (titleId: number, subscriptionId: string) =>
      watchlist.some(w => w.titleId === titleId && w.subscriptionId === subscriptionId),
    [watchlist]
  );

  const toggleWatchlistItem = useCallback(
    async (item: Omit<WatchlistItem, 'id'>) => {
      if (!user) return false;
      const existing = watchlist.find(
        w => w.titleId === item.titleId && w.subscriptionId === item.subscriptionId
      );
      if (existing) {
        await deleteDoc(doc(db, 'users', user.uid, 'watchlist', existing.id));
        return false;
      } else {
        await addDoc(collection(db, 'users', user.uid, 'watchlist'), item);
        return true;
      }
    },
    [user, watchlist]
  );

  const getCountForSubscription = useCallback(
    (subscriptionId: string) =>
      watchlist.filter(w => w.subscriptionId === subscriptionId).length,
    [watchlist]
  );

  return { watchlist, loading, isOnWatchlist, toggleWatchlistItem, getCountForSubscription };
}

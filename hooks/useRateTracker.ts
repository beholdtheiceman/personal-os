"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { RankedOffer, RateProfile, BenchmarkRates } from "@/lib/rate-tracker";

export function useRateTracker() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<RankedOffer[]>([]);
  const [profile, setProfile] = useState<RateProfile | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const authHeader = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }, [user]);

  const fetchOffers = useCallback(async () => {
    if (!user) return;
    const headers = await authHeader();
    const res = await fetch("/api/rate-tracker/offers", { headers });
    if (res.ok) {
      const data = await res.json();
      setOffers(data.offers ?? []);
    }
  }, [user, authHeader]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const headers = await authHeader();
    const res = await fetch("/api/rate-tracker/profile", { headers });
    if (res.ok) {
      const data = await res.json();
      setProfile(data.profile);
    }
  }, [user, authHeader]);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchOffers(), fetchProfile()]).finally(() => setLoading(false));
  }, [user, fetchOffers, fetchProfile]);

  const sync = useCallback(async () => {
    if (!user || syncing) return;
    setSyncing(true);
    try {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      const res = await fetch("/api/rate-tracker/sync", { method: "POST", headers });
      if (res.ok) await fetchOffers();
    } finally {
      setSyncing(false);
    }
  }, [user, syncing, authHeader, fetchOffers]);

  const saveProfile = useCallback(async (p: Partial<RateProfile>) => {
    if (!user) return;
    const headers = { ...(await authHeader()), "Content-Type": "application/json" };
    const res = await fetch("/api/rate-tracker/profile", {
      method: "POST", headers, body: JSON.stringify(p),
    });
    if (res.ok) {
      const data = await res.json();
      setProfile(data.profile);
      await fetchOffers();
    }
  }, [user, authHeader, fetchOffers]);

  const toggleTaken = useCallback(async (offerId: string) => {
    if (!user) return;
    const headers = { ...(await authHeader()), "Content-Type": "application/json" };
    const res = await fetch("/api/rate-tracker/taken", {
      method: "POST", headers, body: JSON.stringify({ offerId }),
    });
    if (res.ok) {
      const { taken } = await res.json();
      setOffers(prev => prev.map(o =>
        o.id === offerId ? { ...o, taken } : o
      ));
    }
  }, [user, authHeader]);

  return { offers, profile, benchmarks, setBenchmarks, loading, syncing, sync, saveProfile, toggleTaken };
}

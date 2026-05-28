"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuth } from "firebase/auth";
import { RiRefreshLine, RiSparklingLine } from "react-icons/ri";

interface WhatMattersDoc {
  content: string;
  generated_at: string;
  date: string;
}

export default function WhatMattersWidget() {
  const { user } = useAuth();
  const [doc, setDoc] = useState<WhatMattersDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const fetchSignal = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch("/api/what-matters", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDoc(data.doc ?? null);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSignal();
  }, [fetchSignal]);

  const handleRefresh = async () => {
    if (!user || refreshing) return;
    setRefreshing(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch("/api/what-matters", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.content) {
        setDoc({ content: data.content, generated_at: new Date().toISOString(), date: today });
      }
    } catch {
      // silently fail
    } finally {
      setRefreshing(false);
    }
  };

  const isStale = doc?.date && doc.date !== today;

  return (
    <div
      className="rounded-2xl p-4 border border-white/10"
      style={{ background: "rgba(10, 4, 16, 0.82)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiSparklingLine className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            What Actually Matters
          </span>
          {isStale && (
            <span className="text-[10px] text-amber-400/70 font-medium">(yesterday)</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Regenerate"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors disabled:opacity-40"
        >
          <RiRefreshLine className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-2 py-1">
          <div className="w-3 h-3 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
          <span className="text-xs text-text-muted">Thinking...</span>
        </div>
      ) : doc?.content ? (
        <p className="text-sm text-text-primary leading-relaxed">
          {doc.content}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-text-muted leading-relaxed">
            No signal yet — Claude synthesizes your Constitution, Season, and live data into one honest read each day.
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs text-accent hover:text-accent/80 font-medium transition-colors disabled:opacity-40"
          >
            {refreshing ? "Generating…" : "Generate now →"}
          </button>
        </div>
      )}
    </div>
  );
}

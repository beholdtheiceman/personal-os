"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import ReactMarkdown from "react-markdown";
import { RiBrainLine, RiRefreshLine } from "react-icons/ri";

interface LifeContextDoc {
  content: string;
  updated_at: string;
  weeks_analyzed: number;
  created_at: string;
}

type ViewState = "loading" | "empty" | "document";

const PRIVACY_NOTE =
  "This document exists only to make your AI conversations more meaningful. It's never used for training or shared externally.";

export default function LifeContextViewer() {
  const { user } = useAuth();
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [contextDoc, setContextDoc] = useState<LifeContextDoc | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, `users/${user.uid}/life_context/main`);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setContextDoc(snap.data() as LifeContextDoc);
        setViewState("document");
      } else {
        setContextDoc(null);
        setViewState("empty");
      }
    });
    return unsub;
  }, [user]);

  const triggerUpdate = async () => {
    if (!user || updating) return;
    setUpdating(true);
    try {
      const token = await getIdToken(auth.currentUser!);
      await fetch("/api/life-context/update", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Silently reset
    } finally {
      setUpdating(false);
    }
  };

  if (viewState === "loading") {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-purple-500 animate-spin" />
      </div>
    );
  }

  if (viewState === "empty") {
    return (
      <div className="flex flex-col items-center text-center py-12 px-4 gap-5">
        <div className="rounded-2xl bg-purple-500/10 p-4">
          <RiBrainLine className="w-8 h-8 text-purple-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-white">Longitudinal Memory</h2>
          <p className="text-sm text-gray-400 max-w-md">
            Claude builds a living picture of your patterns over time — what unlocks you, what
            derails you, health correlations, recurring themes. It grows richer with every weekly
            review.
          </p>
        </div>
        <button
          onClick={triggerUpdate}
          disabled={updating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {updating ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          ) : (
            <RiBrainLine className="w-4 h-4" />
          )}
          {updating ? "Generating..." : "Generate Now"}
        </button>
        <p className="text-xs text-gray-600 italic max-w-sm">{PRIVACY_NOTE}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiBrainLine className="w-5 h-5 text-purple-400" />
          <h2 className="text-base font-semibold text-white">Longitudinal Memory</h2>
        </div>
        <div className="flex items-center gap-3">
          {contextDoc && (
            <span className="text-xs text-gray-500">
              Updated {contextDoc.updated_at} · {contextDoc.weeks_analyzed} week
              {contextDoc.weeks_analyzed !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={triggerUpdate}
            disabled={updating}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {updating ? (
              <div className="w-3.5 h-3.5 rounded-full border border-white/20 border-t-white animate-spin" />
            ) : (
              <RiRefreshLine className="w-3.5 h-3.5" />
            )}
            Update Now
          </button>
        </div>
      </div>

      <div
        className="rounded-xl border border-white/15 px-6 py-5"
        style={{ background: "rgba(10, 4, 16, 0.82)", backdropFilter: "blur(12px)" }}
      >
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{contextDoc?.content ?? ""}</ReactMarkdown>
        </div>
      </div>

      <p className="text-xs text-gray-600 italic">{PRIVACY_NOTE}</p>
    </div>
  );
}

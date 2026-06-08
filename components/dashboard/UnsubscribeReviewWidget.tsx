"use client";
import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getISOWeek, getISOWeekYear } from "date-fns";
import type { UnsubscribeReview, UnsubscribeRecommendation } from "@/types";

function currentISOWeekKey(): string {
  const now = new Date();
  return `${getISOWeekYear(now)}-W${String(getISOWeek(now)).padStart(2, "0")}`;
}

interface SenderCardProps {
  rec: UnsubscribeRecommendation;
  showCheckbox: boolean;
  checked: boolean;
  onToggle: (email: string) => void;
  actionStatus?: "success" | "error";
}

function SenderCard({ rec, showCheckbox, checked, onToggle, actionStatus }: SenderCardProps) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      {showCheckbox && (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(rec.senderEmail)}
          className="mt-0.5 accent-accent"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-text-primary truncate">{rec.senderName}</span>
          <span className="text-xs text-text-secondary/60">{rec.emailCount} this week</span>
          {actionStatus === "success" && (
            <span className="text-xs text-green-400">✓ Unsubscribed</span>
          )}
          {actionStatus === "error" && (
            <span className="text-xs text-red-400">Failed — try manually</span>
          )}
        </div>
        <p className="text-xs text-text-secondary mt-0.5">{rec.reason}</p>
        {rec.sampleSubjects[0] && (
          <p className="text-xs text-text-secondary/40 mt-0.5 truncate italic">
            &ldquo;{rec.sampleSubjects[0]}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribeReviewWidget() {
  const { user } = useAuth();
  const weekKey = currentISOWeekKey();

  const [review, setReview]         = useState<UnsubscribeReview | null>(null);
  const [loading, setLoading]       = useState(true);
  const [running, setRunning]       = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checked, setChecked]       = useState<Set<string>>(new Set());
  const [perStatus, setPerStatus]   = useState<Record<string, "success" | "error">>({});
  const [maybeOpen, setMaybeOpen]   = useState(false);
  const [keepOpen,  setKeepOpen]    = useState(false);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, `users/${user.uid}/unsubscribe_reviews/${weekKey}`);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UnsubscribeReview;
        setReview(data);
        setChecked((prev) => {
          if (prev.size > 0) return prev;
          return new Set(
            data.recommendations
              .filter((r) => r.verdict === "unsubscribe")
              .map((r) => r.senderEmail),
          );
        });
      } else {
        setReview(null);
      }
      setLoading(false);
    });
  }, [user, weekKey]);

  const toggleChecked = useCallback((email: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }, []);

  const runNow = useCallback(async () => {
    if (!user || running) return;
    setRunning(true);
    try {
      const token = await user.getIdToken();
      await fetch("/api/email/unsubscribe-review", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // silent — user can retry
    } finally {
      setRunning(false);
    }
  }, [user, running]);

  const confirmUnsubscribe = useCallback(async () => {
    if (!user || !review || processing) return;
    setProcessing(true);

    const toUnsub = review.recommendations.filter((r) => checked.has(r.senderEmail));
    const statuses: Record<string, "success" | "error"> = {};

    for (const rec of toUnsub) {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/gmail/unsubscribe?uid=${user.uid}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ emailId: rec.emailId }),
        });
        statuses[rec.senderEmail] = res.ok ? "success" : "error";
      } catch {
        statuses[rec.senderEmail] = "error";
      }
    }

    setPerStatus(statuses);

    const unsubscribedFrom = toUnsub
      .filter((r) => statuses[r.senderEmail] === "success")
      .map((r) => r.senderEmail);

    await updateDoc(doc(db, `users/${user.uid}/unsubscribe_reviews/${weekKey}`), {
      status: "acted",
      actedAt: new Date().toISOString(),
      unsubscribedFrom,
    });

    setProcessing(false);
  }, [user, review, checked, processing, weekKey]);

  if (loading) {
    return (
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4">
        <div className="h-4 w-40 bg-white/10 rounded animate-pulse mb-3" />
        <div className="h-3 w-full bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  if (review?.status === "acted") {
    const kept = review.recommendations.length - review.unsubscribedFrom.length;
    return (
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4 space-y-1.5">
        <h3 className="text-sm font-semibold text-text-primary">Unsubscribe Review</h3>
        <p className="text-sm text-text-secondary">
          Unsubscribed from{" "}
          <span className="text-green-400 font-medium">{review.unsubscribedFrom.length}</span>{" "}
          sender{review.unsubscribedFrom.length !== 1 ? "s" : ""} this week
          {kept > 0 && ` · ${kept} kept`}
        </p>
        <p className="text-xs text-text-secondary/50">Next review runs Saturday night.</p>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Unsubscribe Review</h3>
        <p className="text-xs text-text-secondary">
          Runs every Saturday night — scans the week&apos;s email and flags senders worth
          unsubscribing from.
        </p>
        <button
          onClick={runNow}
          disabled={running}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          {running ? "Scanning…" : "Run now"}
        </button>
      </div>
    );
  }

  const unsubRecs = review.recommendations.filter((r) => r.verdict === "unsubscribe");
  const maybeRecs = review.recommendations.filter((r) => r.verdict === "maybe");
  const keepRecs  = review.recommendations.filter((r) => r.verdict === "keep");
  const selectedCount = review.recommendations.filter((r) => checked.has(r.senderEmail)).length;
  const [yr, wk] = review.week.split("-W");

  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          Unsubscribe Review
          <span className="ml-1.5 text-xs font-normal text-text-secondary">
            — Week {wk}, {yr}
          </span>
        </h3>
        {unsubRecs.length > 0 && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
            {unsubRecs.length} flagged
          </span>
        )}
      </div>

      {unsubRecs.length > 0 ? (
        <div>
          {unsubRecs.map((rec) => (
            <SenderCard
              key={rec.senderEmail}
              rec={rec}
              showCheckbox
              checked={checked.has(rec.senderEmail)}
              onToggle={toggleChecked}
              actionStatus={perStatus[rec.senderEmail]}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-secondary">No senders flagged for unsubscribe this week.</p>
      )}

      {maybeRecs.length > 0 && (
        <div>
          <button
            onClick={() => setMaybeOpen((v) => !v)}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
          >
            <span>{maybeOpen ? "▾" : "▸"}</span> Maybe ({maybeRecs.length})
          </button>
          {maybeOpen &&
            maybeRecs.map((rec) => (
              <SenderCard
                key={rec.senderEmail}
                rec={rec}
                showCheckbox
                checked={checked.has(rec.senderEmail)}
                onToggle={toggleChecked}
                actionStatus={perStatus[rec.senderEmail]}
              />
            ))}
        </div>
      )}

      {keepRecs.length > 0 && (
        <div>
          <button
            onClick={() => setKeepOpen((v) => !v)}
            className="text-xs text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
          >
            <span>{keepOpen ? "▾" : "▸"}</span> Keep ({keepRecs.length})
          </button>
          {keepOpen &&
            keepRecs.map((rec) => (
              <SenderCard
                key={rec.senderEmail}
                rec={rec}
                showCheckbox={false}
                checked={false}
                onToggle={() => {}}
              />
            ))}
        </div>
      )}

      {(review.skippedCount ?? 0) > 0 && (
        <p className="text-xs text-text-secondary/50">
          {review.skippedCount} more sender{review.skippedCount !== 1 ? "s" : ""} not evaluated
          this week (cap: 20).
        </p>
      )}

      {(unsubRecs.length > 0 || maybeRecs.length > 0) && (
        <button
          onClick={confirmUnsubscribe}
          disabled={processing || selectedCount === 0}
          className="w-full text-sm py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors disabled:opacity-50"
        >
          {processing
            ? "Unsubscribing…"
            : selectedCount === 0
              ? "Select senders to unsubscribe"
              : `Unsubscribe from selected (${selectedCount})`}
        </button>
      )}
    </div>
  );
}

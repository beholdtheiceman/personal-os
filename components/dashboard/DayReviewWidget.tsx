"use client";
import { useDayReview } from "@/hooks/useDayReview";
import { useWidgetRefresh } from "@/hooks/useWidgetRefresh";

export default function DayReviewWidget() {
  const { todayReview, streak, loading } = useDayReview();
  useWidgetRefresh("day_review", () => {});

  function open() {
    window.dispatchEvent(new CustomEvent("os:open-day-review"));
  }

  if (loading) return null;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          🌙 Day Review
          {streak > 0 && <span className="text-xs text-amber-400">{streak} day streak 🔥</span>}
        </h3>
        {!todayReview && (
          <button onClick={open} className="text-xs text-accent hover:underline">Start →</button>
        )}
      </div>

      {todayReview ? (
        <div className="space-y-2">
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Tomorrow</p>
            <p className="text-sm text-text-primary line-clamp-2">{todayReview.q3 || "—"}</p>
          </div>
          <button onClick={open} className="text-xs text-text-secondary hover:text-text-primary transition-colors">
            View / edit →
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-text-secondary mb-3">3 questions · under 2 minutes</p>
          <button onClick={open} className="btn-primary text-xs py-1.5 px-4">Start day review</button>
        </div>
      )}
    </div>
  );
}

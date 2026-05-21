"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useWeeklyReview } from "@/hooks/useWeeklyReview";
import { getIdToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import ReactMarkdown from "react-markdown";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { RiRefreshLine, RiCalendarCheckLine, RiAlertLine } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import toast from "react-hot-toast";

export default function WeeklyReviewWidget() {
  const { user } = useAuth();
  const { review, loading } = useWeeklyReview();
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const generate = async () => {
    if (!user || generating) return;
    setGenerating(true);
    try {
      const token = await getIdToken(auth.currentUser!);
      const res = await fetch("/api/weekly-review", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status?.startsWith("error")) {
        toast.error("Failed to generate review");
      } else {
        toast.success("Weekly review generated");
        setExpanded(true);
      }
    } catch {
      toast.error("Failed to generate review");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return null;

  const weekLabel = review?.week_start
    ? `Week of ${format(parseISO(review.week_start), "MMM d")}`
    : null;

  const timeAgo = review?.generated_at
    ? formatDistanceToNow(parseISO(review.generated_at), { addSuffix: true })
    : null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
            <RiCalendarCheckLine className="w-3.5 h-3.5" /> Weekly Review
          </h2>
          {weekLabel && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent">
              {weekLabel}
            </span>
          )}
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1.5 text-xs btn-ghost disabled:opacity-50"
        >
          {generating ? <LoadingDots /> : <><RiRefreshLine className="w-3.5 h-3.5" />{review ? "Regenerate" : "Generate"}</>}
        </button>
      </div>

      {/* Error state */}
      {review?.last_error && !review.content && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20">
          <RiAlertLine className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <p className="text-xs text-danger">{review.last_error}</p>
        </div>
      )}

      {/* Empty state */}
      {!review?.content && !generating && (
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm mb-1">No review yet for this week.</p>
          <p className="text-text-muted text-xs mb-4">Generates automatically every Sunday — or trigger it manually anytime.</p>
          <button onClick={generate} className="btn-primary text-sm">
            Generate This Week's Review
          </button>
        </div>
      )}

      {generating && !review?.content && (
        <div className="py-8 flex justify-center"><LoadingDots /></div>
      )}

      {/* Review content */}
      {review?.content && (
        <>
          {/* Collapsed preview */}
          {!expanded && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted line-clamp-3 prose-dark">
                {review.content.replace(/#{1,3} .+\n/g, "").replace(/[*_`]/g, "").trim()}
              </p>
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Read full review →
              </button>
            </div>
          )}

          {/* Expanded */}
          {expanded && (
            <>
              <div className="prose-dark text-sm">
                <ReactMarkdown>{review.content}</ReactMarkdown>
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.08]">
                <span className="text-xs text-text-muted">Generated {timeAgo}</span>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Collapse
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

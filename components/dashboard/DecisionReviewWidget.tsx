"use client";
import Link from "next/link";
import { useDecisions } from "@/hooks/useDecisions";
import { RiLightbulbLine, RiArrowRightLine } from "react-icons/ri";
import { format, parseISO } from "date-fns";

export default function DecisionReviewWidget() {
  const { pendingReview, loading } = useDecisions();

  if (loading || pendingReview.length === 0) return null;

  return (
    <div className="card border-warning/30 bg-warning/5 space-y-2">
      <div className="flex items-center gap-2">
        <RiLightbulbLine className="w-4 h-4 text-warning" />
        <h2 className="text-sm font-semibold text-text-primary">Decisions Due for Review</h2>
        <span className="ml-auto text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded-full font-medium">
          {pendingReview.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {pendingReview.slice(0, 3).map((d) => (
          <div key={d.id} className="flex items-center justify-between text-sm">
            <span className="text-text-primary truncate">{d.title}</span>
            <span className="text-xs text-text-muted shrink-0 ml-2">
              due {format(parseISO(d.review_date), "MMM d")}
            </span>
          </div>
        ))}
      </div>
      <Link href="/decisions?tab=pending_review" className="flex items-center gap-1 text-xs text-warning hover:text-warning/80 transition-colors">
        Review now <RiArrowRightLine className="w-3 h-3" />
      </Link>
    </div>
  );
}

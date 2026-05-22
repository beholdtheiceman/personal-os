"use client";
import { useState } from "react";
import { format, isPast, parseISO } from "date-fns";
import { RiArrowDownSLine, RiArrowUpSLine, RiEditLine, RiDeleteBinLine, RiCheckLine } from "react-icons/ri";
import { useDecisions } from "@/hooks/useDecisions";
import DecisionReview from "./DecisionReview";
import type { Decision } from "@/types";

interface Props {
  decision: Decision;
  onEdit: (d: Decision) => void;
}

export default function DecisionCard({ decision: d, onEdit }: Props) {
  const { deleteDecision } = useDecisions();
  const [expanded, setExpanded] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const isDueForReview = d.status === "pending_review" && isPast(parseISO(d.review_date));

  return (
    <>
      <div className="card space-y-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-text-primary">{d.title}</span>
              {isDueForReview && (
                <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded font-medium">Due for review</span>
              )}
              {d.status === "reviewed" && (
                <span className="text-[10px] bg-success/20 text-success px-1.5 py-0.5 rounded font-medium">Reviewed</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
              <span>{format(parseISO(d.date), "MMM d, yyyy")}</span>
              {d.tags && d.tags.length > 0 && (
                <span>· {d.tags.join(", ")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isDueForReview && (
              <button
                onClick={() => setReviewing(true)}
                title="Write review"
                className="p-1 text-text-muted hover:text-success transition-colors"
              >
                <RiCheckLine className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => onEdit(d)} className="p-1 text-text-muted hover:text-accent transition-colors">
              <RiEditLine className="w-4 h-4" />
            </button>
            <button onClick={() => deleteDecision(d.id)} className="p-1 text-text-muted hover:text-danger transition-colors">
              <RiDeleteBinLine className="w-4 h-4" />
            </button>
            <button onClick={() => setExpanded((x) => !x)} className="p-1 text-text-muted hover:text-text-secondary transition-colors">
              {expanded ? <RiArrowUpSLine className="w-4 h-4" /> : <RiArrowDownSLine className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!expanded && (
          <p className="text-xs text-text-muted truncate">
            Chose: <span className="text-text-secondary">{d.chosen_option}</span>
          </p>
        )}

        {expanded && (
          <div className="border-t border-bg-border pt-3 space-y-3 text-sm">
            {d.context && (
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">Context</p>
                <p className="text-text-primary text-sm">{d.context}</p>
              </div>
            )}
            {d.options_considered.length > 0 && (
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">Options considered</p>
                <ul className="list-disc list-inside space-y-0.5 text-text-primary text-sm">
                  {d.options_considered.map((o, i) => (
                    <li key={i} className={o === d.chosen_option ? "text-accent font-medium" : ""}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
            {d.reasoning && (
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">Reasoning</p>
                <p className="text-text-primary text-sm">{d.reasoning}</p>
              </div>
            )}
            {d.expected_outcome && (
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">Expected outcome</p>
                <p className="text-text-primary text-sm">{d.expected_outcome}</p>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Review by: {format(parseISO(d.review_date), "MMM d, yyyy")}</span>
              {d.outcome_rating && (
                <span>Outcome rating: {d.outcome_rating}/5</span>
              )}
            </div>
            {d.review_notes && (
              <div>
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">Review notes</p>
                <p className="text-text-primary text-sm">{d.review_notes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {reviewing && (
        <DecisionReview decision={d} onClose={() => setReviewing(false)} />
      )}
    </>
  );
}

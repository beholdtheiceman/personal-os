"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { RiSparklingLine, RiRefreshLine, RiArrowDownSLine, RiArrowUpSLine, RiDatabase2Line } from "react-icons/ri";
import { useInsights } from "@/hooks/useInsights";

export default function InsightsWidget() {
  const { latest, loading, generating, hasToday, generate } = useInsights();
  const [expanded, setExpanded] = useState(true);

  if (loading) return null;

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiSparklingLine className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-text-primary">AI Insights</span>
          {latest && (
            <span className="text-xs text-text-muted">{latest.date}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={generate}
            disabled={generating}
            title={hasToday ? "Regenerate today's insight" : "Generate insight"}
            className={`btn-ghost p-1.5 transition-colors ${generating ? "animate-spin text-accent" : "hover:text-accent"}`}
          >
            <RiRefreshLine className="w-4 h-4" />
          </button>
          {latest && (
            <button onClick={() => setExpanded((v) => !v)} className="btn-ghost p-1.5">
              {expanded ? <RiArrowUpSLine className="w-4 h-4" /> : <RiArrowDownSLine className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!latest && !generating && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <RiDatabase2Line className="w-8 h-8 text-text-muted/40" />
          <p className="text-xs text-text-muted max-w-xs">
            Claude will analyze your mood, sleep, habits, workouts, and more to surface correlations you might miss.
          </p>
          <button
            onClick={generate}
            className="btn-primary text-sm py-1.5 flex items-center gap-1.5"
          >
            <RiSparklingLine className="w-4 h-4" />
            Generate Insights
          </button>
        </div>
      )}

      {generating && (
        <div className="flex items-center gap-2 text-sm text-text-muted py-2">
          <RiRefreshLine className="w-4 h-4 animate-spin text-accent" />
          Analyzing your data…
        </div>
      )}

      {latest && expanded && !generating && (
        <>
          <div className="prose prose-sm prose-invert max-w-none text-text-secondary [&>ul]:space-y-1.5 [&>ul>li]:text-xs [&>p]:text-xs [&>ul>li]:leading-relaxed">
            <ReactMarkdown>{latest.content}</ReactMarkdown>
          </div>
          {latest.data_sources.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-bg-border">
              <span className="text-[10px] text-text-muted">Sources:</span>
              {latest.data_sources.map((src) => (
                <span key={src} className="text-[10px] bg-bg-tertiary text-text-muted px-1.5 py-0.5 rounded-md">{src}</span>
              ))}
            </div>
          )}
          {!hasToday && (
            <p className="text-[10px] text-text-muted">
              Showing insight from {latest.date}.{" "}
              <button onClick={generate} className="text-accent hover:underline">Generate today's</button>
            </p>
          )}
        </>
      )}
    </div>
  );
}

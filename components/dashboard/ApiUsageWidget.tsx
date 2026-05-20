"use client";
import { useApiUsage } from "@/hooks/useApiUsage";
import { RiRobot2Line, RiArrowUpLine, RiArrowDownLine } from "react-icons/ri";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function ApiUsageWidget() {
  const { today, month, last7Days, estimatedCostUsd, loading } = useApiUsage();

  // Bar chart: scale relative to max day in the window
  const maxTokens = Math.max(...last7Days.map((d) => d.input_tokens + d.output_tokens), 1);

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiRobot2Line className="w-4 h-4 text-accent" />
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Claude API Usage
          </h2>
        </div>
        <span className="text-xs text-text-muted">claude-sonnet-4</span>
      </div>

      {/* Today vs Month */}
      <div className="grid grid-cols-2 gap-3">
        {/* Today */}
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">Today</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-text-secondary">
                <RiArrowUpLine className="w-3 h-3 text-accent" /> In
              </span>
              <span className="text-xs font-medium text-text-primary">{fmt(today.input_tokens)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-text-secondary">
                <RiArrowDownLine className="w-3 h-3 text-accent/70" /> Out
              </span>
              <span className="text-xs font-medium text-text-primary">{fmt(today.output_tokens)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <span className="text-[10px] text-text-muted">Requests</span>
              <span className="text-xs font-medium text-text-primary">{today.requests}</span>
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">This Month</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-text-secondary">
                <RiArrowUpLine className="w-3 h-3 text-accent" /> In
              </span>
              <span className="text-xs font-medium text-text-primary">{fmt(month.input_tokens)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-text-secondary">
                <RiArrowDownLine className="w-3 h-3 text-accent/70" /> Out
              </span>
              <span className="text-xs font-medium text-text-primary">{fmt(month.output_tokens)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <span className="text-[10px] text-text-muted">Est. cost</span>
              <span className="text-xs font-semibold text-accent">
                ${estimatedCostUsd.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7-day bar chart */}
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">Last 7 Days</p>
        <div className="flex items-end gap-1 h-12">
          {last7Days.map((d) => {
            const total = d.input_tokens + d.output_tokens;
            const heightPct = Math.max((total / maxTokens) * 100, total > 0 ? 8 : 2);
            const isToday = d.date === new Date().toLocaleDateString("en-CA");
            const dayLabel = new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "narrow" });
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center" style={{ height: "36px" }}>
                  <div
                    title={`${d.date}: ${fmt(d.input_tokens)} in / ${fmt(d.output_tokens)} out`}
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: `${heightPct}%`,
                      background: isToday
                        ? "rgba(196, 114, 138, 0.85)"
                        : "rgba(196, 114, 138, 0.35)",
                    }}
                  />
                </div>
                <span className={`text-[9px] ${isToday ? "text-accent font-medium" : "text-text-muted"}`}>
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-text-muted">
        Pricing: $3 / $15 per 1M tokens (in / out) · Sonnet 4
      </p>
    </div>
  );
}

"use client";
import { format, subDays } from "date-fns";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import type { TimeCategory } from "@/types";

const CATEGORY_COLORS: Record<TimeCategory, string> = {
  work:     "#60a5fa",
  personal: "#c084fc",
  health:   "#34d399",
  learning: "#fbbf24",
  other:    "#6b7280",
};

function fmtH(min: number) {
  if (min < 60) return `${min}m`;
  return `${(min / 60).toFixed(1)}h`;
}

export default function WeeklyTimeChart() {
  const { entries, weeklyByCategory } = useTimeTracker();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return format(d, "yyyy-MM-dd");
  });

  const maxDayMin = Math.max(
    ...days.map((d) => entries.filter((e) => e.date === d).reduce((s, e) => s + e.duration_min, 0)),
    1
  );

  const BAR_H = 80;

  return (
    <div className="space-y-4">
      {/* Bar chart — stacked by day */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">Daily Breakdown</p>
        <div className="flex items-end gap-1.5">
          {days.map((d) => {
            const dayEntries = entries.filter((e) => e.date === d);
            const total = dayEntries.reduce((s, e) => s + e.duration_min, 0);
            const barH = total > 0 ? Math.max((total / maxDayMin) * BAR_H, 4) : 0;
            const label = format(new Date(d + "T12:00:00"), "EEE");

            // Stack segments by category
            const byCat = dayEntries.reduce<Record<string, number>>((acc, e) => {
              acc[e.category] = (acc[e.category] ?? 0) + e.duration_min;
              return acc;
            }, {});

            return (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-text-muted">{total > 0 ? fmtH(total) : ""}</span>
                <div className="w-full flex flex-col-reverse rounded-sm overflow-hidden" style={{ height: BAR_H }}>
                  <div style={{ height: barH }} className="w-full flex flex-col-reverse overflow-hidden rounded-sm">
                    {(Object.entries(byCat) as [TimeCategory, number][]).map(([cat, min]) => (
                      <div
                        key={cat}
                        style={{ height: `${(min / total) * 100}%`, backgroundColor: CATEGORY_COLORS[cat] ?? "#6b7280" }}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-[9px] text-text-muted">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">By Category (7 days)</p>
        <div className="space-y-2">
          {(Object.entries(weeklyByCategory) as [TimeCategory, number][])
            .filter(([, min]) => min > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, min]) => {
              const maxMin = Math.max(...Object.values(weeklyByCategory));
              const pct = maxMin > 0 ? min / maxMin : 0;
              return (
                <div key={cat} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize text-text-secondary">{cat}</span>
                    <span className="text-text-muted">{fmtH(min)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct * 100}%`, backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

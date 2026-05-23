"use client";
import { useMemo } from "react";
import { subDays, format } from "date-fns";

interface HabitStatsProps {
  completions: string[];
  targetDays: number[];  // 0=Sun … 6=Sat
  todayStr: string;      // "YYYY-MM-DD"
}

// Day-label rows shown in the heatmap left gutter (Mon/Wed/Fri only)
const DAY_LABELS: Record<number, string> = { 1: "Mon", 3: "Wed", 5: "Fri" };

export default function HabitStats({ completions, targetDays, todayStr }: HabitStatsProps) {
  const completionSet = useMemo(() => new Set(completions), [completions]);
  const targetSet = useMemo(() => new Set(targetDays), [targetDays]);

  // ── Computed stats ──────────────────────────────────────────────────────────
  const { currentStreak, longestStreak, rate30 } = useMemo(() => {
    const today = new Date(`${todayStr}T00:00:00`);

    // Current streak: walk backwards from today, skip non-target days,
    // count consecutive completed target days, break on first miss.
    let currentStreak = 0;
    {
      let cursor = today;
      // Allow up to 400 days of look-back so we don't loop forever
      for (let i = 0; i < 400; i++) {
        const dow = cursor.getDay();
        const ds = format(cursor, "yyyy-MM-dd");
        // Skip dates in the future (safety guard)
        if (ds > todayStr) { cursor = subDays(cursor, 1); continue; }
        if (!targetSet.has(dow)) { cursor = subDays(cursor, 1); continue; }
        if (completionSet.has(ds)) {
          currentStreak++;
          cursor = subDays(cursor, 1);
        } else {
          break;
        }
      }
    }

    // Longest streak over last 365 days: oldest → newest
    let longestStreak = 0;
    {
      let run = 0;
      for (let i = 364; i >= 0; i--) {
        const d = subDays(today, i);
        const ds = format(d, "yyyy-MM-dd");
        if (ds > todayStr) continue;
        const dow = d.getDay();
        if (!targetSet.has(dow)) continue; // non-target: don't break, just skip
        if (completionSet.has(ds)) {
          run++;
          if (run > longestStreak) longestStreak = run;
        } else {
          run = 0;
        }
      }
    }

    // 30-day completion rate on target days
    let targetCount = 0;
    let doneCount = 0;
    for (let i = 0; i < 30; i++) {
      const d = subDays(today, i);
      const ds = format(d, "yyyy-MM-dd");
      if (ds > todayStr) continue;
      if (!targetSet.has(d.getDay())) continue;
      targetCount++;
      if (completionSet.has(ds)) doneCount++;
    }
    const rate30 = targetCount > 0 ? Math.round((doneCount / targetCount) * 100) : 0;

    return { currentStreak, longestStreak, rate30 };
  }, [completionSet, targetSet, todayStr]);

  // ── Heatmap grid (16 weeks, columns oldest→newest, rows Sun=0..Sat=6) ───────
  const weeks = useMemo(() => {
    const today = new Date(`${todayStr}T00:00:00`);
    // Start on the Sunday of the week that is 15 weeks ago
    const todayDow = today.getDay(); // 0=Sun
    // The first day of the current week (Sunday)
    const currentWeekStart = subDays(today, todayDow);
    // Go back 15 more weeks
    const gridStart = subDays(currentWeekStart, 15 * 7);

    const grid: Array<Array<{ dateStr: string; state: "done" | "missed" | "off" | "future" }>> = [];

    for (let w = 0; w < 16; w++) {
      const week: typeof grid[0] = [];
      for (let dow = 0; dow < 7; dow++) {
        const d = subDays(today, (15 - w) * 7 + (todayDow - dow));
        // Recompute properly: gridStart + w weeks + dow days
        const cell = new Date(gridStart);
        cell.setDate(cell.getDate() + w * 7 + dow);
        const ds = format(cell, "yyyy-MM-dd");
        let state: "done" | "missed" | "off" | "future";
        if (ds > todayStr) {
          state = "future";
        } else if (!targetSet.has(dow)) {
          state = "off";
        } else if (completionSet.has(ds)) {
          state = "done";
        } else {
          state = "missed";
        }
        week.push({ dateStr: ds, state });
      }
      grid.push(week);
    }
    return grid;
  }, [completionSet, targetSet, todayStr]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="mt-3 space-y-3">
      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="flex gap-[3px] min-w-max">
          {/* Day labels gutter */}
          <div className="flex flex-col gap-[3px] mr-1">
            {Array.from({ length: 7 }, (_, dow) => (
              <div
                key={dow}
                className="h-[10px] flex items-center"
                style={{ fontSize: "8px" }}
              >
                <span className="text-text-muted leading-none w-6 text-right pr-0.5">
                  {DAY_LABELS[dow] ?? ""}
                </span>
              </div>
            ))}
          </div>

          {/* Week columns */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map(({ dateStr, state }, dow) => {
                let cls = "w-[10px] h-[10px] rounded-sm ";
                if (state === "done") {
                  cls += "bg-success";
                } else if (state === "missed") {
                  cls += "bg-bg-tertiary border border-bg-border";
                } else {
                  // "off" or "future" — transparent/invisible
                  cls += "bg-transparent";
                }
                return (
                  <div
                    key={dateStr}
                    className={cls}
                    title={state !== "off" && state !== "future" ? dateStr : undefined}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-text-primary">{currentStreak}</span>
          <span className="text-[9px] text-text-muted uppercase tracking-wide leading-tight">Current streak</span>
        </div>
        <div className="w-px h-6 bg-bg-border" />
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-text-primary">{longestStreak}</span>
          <span className="text-[9px] text-text-muted uppercase tracking-wide leading-tight">Longest (365d)</span>
        </div>
        <div className="w-px h-6 bg-bg-border" />
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-text-primary">{rate30}%</span>
          <span className="text-[9px] text-text-muted uppercase tracking-wide leading-tight">30-day rate</span>
        </div>
      </div>
    </div>
  );
}

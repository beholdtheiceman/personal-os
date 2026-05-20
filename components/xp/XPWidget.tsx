"use client";
import { useXP } from "@/hooks/useXP";
import { RiBoltLine } from "react-icons/ri";

export default function XPWidget() {
  const { totalXP, levelInfo, recentEvents, loaded } = useXP();

  if (!loaded) return null;

  const { level, title, xpIntoLevel, xpEnd, xpStart, progress } = levelInfo;
  const xpForThisLevel = xpEnd - xpStart;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold shadow-sm">
            {level}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Level {level} · {title}</p>
            <p className="text-xs text-text-muted">{totalXP.toLocaleString()} XP total</p>
          </div>
        </div>
        <RiBoltLine className="w-5 h-5 text-accent" />
      </div>

      {/* XP progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>{xpIntoLevel} / {xpForThisLevel} XP</span>
          <span>{levelInfo.xpNeeded} to Level {level + 1}</span>
        </div>
        <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700"
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Recent XP events */}
      {recentEvents.length > 0 && (
        <div className="space-y-1">
          {recentEvents.slice(0, 3).map((e) => (
            <div key={e.id} className="flex items-center justify-between">
              <span className="text-xs text-text-secondary truncate">{e.description}</span>
              <span className="text-xs font-medium text-accent shrink-0 ml-2">+{e.xp} XP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

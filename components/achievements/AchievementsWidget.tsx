"use client";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { RiTrophyLine } from "react-icons/ri";
import { useAchievements } from "@/hooks/useAchievements";
import { ACHIEVEMENT_MAP } from "@/lib/achievements";

export default function AchievementsWidget() {
  const { unlocks, totalGamerscore, maxGamerscore, loaded } = useAchievements();

  if (!loaded) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
          <RiTrophyLine className="w-3.5 h-3.5" /> Achievements
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-400">
            {totalGamerscore}G
          </span>
          <span className="text-xs text-text-muted">/ {maxGamerscore}G</span>
          <Link href="/achievements" className="text-xs text-accent hover:text-accent-text">
            View all
          </Link>
        </div>
      </div>

      {unlocks.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4">
          No achievements yet — keep going!
        </p>
      ) : (
        <div className="space-y-2">
          {unlocks.slice(0, 3).map((u) => {
            const def = ACHIEVEMENT_MAP[u.id];
            return (
              <div key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <span className="text-base shrink-0">🏆</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {def?.title ?? u.id}
                  </p>
                  <p className="text-xs text-text-muted">
                    {format(parseISO(u.unlockedAt), "MMM d")}
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-400 shrink-0">+{u.gamerscore}G</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

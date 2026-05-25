"use client";
import { format, parseISO } from "date-fns";
import { RiTrophyLine, RiLockLine } from "react-icons/ri";
import { useAchievements } from "@/hooks/useAchievements";
import { ACHIEVEMENTS, TOTAL_GAMERSCORE } from "@/lib/achievements";
import type { AchievementCategory } from "@/types";

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  tasks:         "Tasks",
  habits:        "Habits",
  health:        "Health & Fitness",
  journal:       "Journal",
  goals_finance: "Goals & Finance",
  reading:       "Reading",
  people:        "People",
  ai_app:        "AI & App",
  secret:        "Secret",
};

const CATEGORY_ORDER: AchievementCategory[] = [
  "tasks", "habits", "health", "journal",
  "goals_finance", "reading", "people", "ai_app", "secret",
];

export default function AchievementsPage() {
  const { unlocks, totalGamerscore, loaded } = useAchievements();

  const unlockedIds = new Set(unlocks.map((u) => u.id));
  const unlockMap = Object.fromEntries(unlocks.map((u) => [u.id, u]));

  const byCategory = Object.fromEntries(
    CATEGORY_ORDER.map((cat) => [
      cat,
      ACHIEVEMENTS.filter((a) => a.category === cat),
    ])
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Achievements</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {unlockedIds.size} / {ACHIEVEMENTS.length} unlocked
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-amber-400">{totalGamerscore}G</p>
          <p className="text-xs text-text-muted">/ {TOTAL_GAMERSCORE}G Gamerscore</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400 transition-all"
          style={{ width: `${(totalGamerscore / TOTAL_GAMERSCORE) * 100}%` }}
        />
      </div>

      {/* Categories */}
      {loaded && CATEGORY_ORDER.map((cat) => {
        const defs = byCategory[cat];
        const catUnlocked = defs.filter((a) => unlockedIds.has(a.id)).length;
        return (
          <div key={cat}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                {CATEGORY_LABELS[cat]}
              </h2>
              <span className="text-xs text-text-muted">{catUnlocked}/{defs.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {defs.map((def) => {
                const unlock = unlockMap[def.id];
                const isUnlocked = !!unlock;
                const isSecret = def.secret && !isUnlocked;

                return (
                  <div
                    key={def.id}
                    className={`card flex items-start gap-3 transition-all ${
                      isUnlocked
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "opacity-50"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isUnlocked ? "bg-amber-500/20" : "bg-bg-tertiary"
                    }`}>
                      {isUnlocked ? (
                        <RiTrophyLine className="w-5 h-5 text-amber-400" />
                      ) : (
                        <RiLockLine className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold truncate ${
                          isUnlocked ? "text-text-primary" : "text-text-secondary"
                        }`}>
                          {isSecret ? "???" : def.title}
                        </p>
                        <span className={`text-xs font-bold shrink-0 ${
                          isUnlocked ? "text-amber-400" : "text-text-muted"
                        }`}>
                          {def.gamerscore}G
                        </span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        {isSecret ? "Keep playing to discover this achievement." : def.description}
                      </p>
                      {isUnlocked && unlock && (
                        <p className="text-xs text-amber-400/70 mt-1">
                          Unlocked {format(parseISO(unlock.unlockedAt), "MMM d, yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

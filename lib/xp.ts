// XP / Gamification utilities

export interface LevelInfo {
  level: number;
  title: string;
  xpStart: number;   // total XP at the start of this level
  xpEnd: number;     // total XP needed to reach next level
  xpIntoLevel: number; // XP earned within this level
  xpNeeded: number;  // XP remaining to next level
  progress: number;  // 0–1 fraction through current level
}

// Each level requires level * 150 XP to advance
// Cumulative XP to reach level n: 75 * n * (n - 1)
// Level 1: 0–149, Level 2: 150–449, Level 3: 450–899, etc.
export function xpForLevel(level: number): number {
  return 75 * level * (level - 1);
}

const LEVEL_TITLES: Record<number, string> = {
  1: "Beginner",
  2: "Consistent",
  3: "Focused",
  4: "Disciplined",
  5: "Habit Hero",
  6: "Achiever",
  7: "Peak Performer",
  8: "Elite",
  9: "Legend",
  10: "Master",
};

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level, 10)] ?? "Master";
}

export function getLevelInfo(totalXP: number): LevelInfo {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXP) level++;

  const xpStart = xpForLevel(level);
  const xpEnd = xpForLevel(level + 1);
  const xpIntoLevel = totalXP - xpStart;
  const xpNeeded = xpEnd - totalXP;
  const progress = xpIntoLevel / (xpEnd - xpStart);

  return { level, title: getLevelTitle(level), xpStart, xpEnd, xpIntoLevel, xpNeeded, progress };
}

// Habit streak XP multipliers — applied to the per-completion award.
export function streakMultiplier(streak: number): number {
  if (streak >= 365) return 3;
  if (streak >= 120) return 2.5;
  if (streak >= 30)  return 2;
  if (streak >= 7)   return 1.5;
  return 1;
}

// ── XP award amounts ──────────────────────────────────────────────────────────
export function habitXP(streakLength: number): number {
  const base = 10;
  const bonus = Math.min(streakLength * 2, 20); // up to +20 bonus for long streaks
  return Math.round((base + bonus) * streakMultiplier(streakLength));
}

export function taskXP(priorityScore: number): number {
  // priority_score 1–100 → 10–30 XP
  return 10 + Math.round((priorityScore / 100) * 20);
}

export const JOURNAL_XP = 20;
export const HEALTH_LOG_XP = 15;
export const GOAL_MILESTONE_XP = 50;
export const GOAL_COMPLETE_XP = 200;

import type { AchievementDef } from "@/types";

export const ACHIEVEMENTS: AchievementDef[] = [
  // ─── Tasks ────────────────────────────────────────────────────────────────
  {
    id: "first_blood",
    title: "First Blood",
    description: "Complete your first task.",
    gamerscore: 10,
    category: "tasks",
  },
  {
    id: "triple_digits",
    title: "Triple Digits",
    description: "Complete 100 tasks.",
    gamerscore: 25,
    category: "tasks",
  },
  {
    id: "the_machine",
    title: "The Machine",
    description: "Complete 500 tasks.",
    gamerscore: 50,
    category: "tasks",
  },
  {
    id: "ahead_of_the_curve",
    title: "Ahead of the Curve",
    description: "Complete a task before its due date.",
    gamerscore: 25,
    category: "tasks",
  },

  // ─── Habits ───────────────────────────────────────────────────────────────
  {
    id: "creature_of_habit",
    title: "Creature of Habit",
    description: "Complete a habit for the first time.",
    gamerscore: 10,
    category: "habits",
  },
  {
    id: "week_one",
    title: "Week One",
    description: "Reach a 7-day habit streak.",
    gamerscore: 10,
    category: "habits",
  },
  {
    id: "the_long_game",
    title: "The Long Game",
    description: "Reach a 30-day habit streak.",
    gamerscore: 25,
    category: "habits",
  },
  {
    id: "unbreakable",
    title: "Unbreakable",
    description: "Reach a 100-day habit streak.",
    gamerscore: 50,
    category: "habits",
  },
  {
    id: "perfect_day",
    title: "Perfect Day",
    description: "Complete every scheduled habit in a single day.",
    gamerscore: 25,
    category: "habits",
  },

  // ─── Health & Fitness ─────────────────────────────────────────────────────
  {
    id: "body_check",
    title: "Body Check",
    description: "Log your first health entry.",
    gamerscore: 10,
    category: "health",
  },
  {
    id: "ten_k_club",
    title: "10K Club",
    description: "Log 10,000 steps in a single day.",
    gamerscore: 25,
    category: "health",
  },
  {
    id: "full_tank",
    title: "Full Tank",
    description: "Hit your daily hydration goal.",
    gamerscore: 10,
    category: "health",
  },
  {
    id: "sweat_equity",
    title: "Sweat Equity",
    description: "Log your first workout.",
    gamerscore: 10,
    category: "health",
  },
  {
    id: "pr_breaker",
    title: "PR Breaker",
    description: "Set a new personal record on any exercise.",
    gamerscore: 25,
    category: "health",
  },
  {
    id: "century_club",
    title: "Century Club",
    description: "Log 50 workouts.",
    gamerscore: 50,
    category: "health",
  },

  // ─── Journal ──────────────────────────────────────────────────────────────
  {
    id: "dear_diary",
    title: "Dear Diary",
    description: "Write your first journal entry.",
    gamerscore: 10,
    category: "journal",
  },
  {
    id: "stream_of_consciousness",
    title: "Stream of Consciousness",
    description: "Record your first voice journal entry.",
    gamerscore: 10,
    category: "journal",
  },
  {
    id: "thirty_days_of_truth",
    title: "30 Days of Truth",
    description: "Write 30 journal entries.",
    gamerscore: 25,
    category: "journal",
  },

  // ─── Goals & Finance ──────────────────────────────────────────────────────
  {
    id: "milestone_reached",
    title: "Milestone Reached",
    description: "Complete your first goal milestone.",
    gamerscore: 10,
    category: "goals_finance",
  },
  {
    id: "goal_digger",
    title: "Goal Digger",
    description: "Complete a goal.",
    gamerscore: 25,
    category: "goals_finance",
  },
  {
    id: "in_the_black",
    title: "In the Black",
    description: "Finish a month under budget in every category.",
    gamerscore: 25,
    category: "goals_finance",
  },
  {
    id: "nest_egg",
    title: "Nest Egg",
    description: "Hit 100% of a savings goal.",
    gamerscore: 25,
    category: "goals_finance",
  },

  // ─── Reading ──────────────────────────────────────────────────────────────
  {
    id: "page_turner",
    title: "Page Turner",
    description: "Finish your first book.",
    gamerscore: 10,
    category: "reading",
  },
  {
    id: "bibliophile",
    title: "Bibliophile",
    description: "Finish 10 books.",
    gamerscore: 25,
    category: "reading",
  },
  {
    id: "highlight_reel",
    title: "Highlight Reel",
    description: "Save 25 highlights across your reading list.",
    gamerscore: 10,
    category: "reading",
  },

  // ─── People ───────────────────────────────────────────────────────────────
  {
    id: "social_network",
    title: "Social Network",
    description: "Add your first contact.",
    gamerscore: 10,
    category: "people",
  },
  {
    id: "never_forget",
    title: "Never Forget",
    description: "Log an interaction on a contact's birthday.",
    gamerscore: 25,
    category: "people",
  },
  {
    id: "people_person",
    title: "People Person",
    description: "Log 50 interactions.",
    gamerscore: 25,
    category: "people",
  },

  // ─── AI & App ─────────────────────────────────────────────────────────────
  {
    id: "hello_world",
    title: "Hello World",
    description: "Send your first chat message.",
    gamerscore: 10,
    category: "ai_app",
  },
  {
    id: "power_user",
    title: "Power User",
    description: "Send 500 chat messages.",
    gamerscore: 50,
    category: "ai_app",
  },
  {
    id: "capture_artist",
    title: "Capture Artist",
    description: "Save your first capture via the browser extension.",
    gamerscore: 10,
    category: "ai_app",
  },
  {
    id: "connected",
    title: "Connected",
    description: "Link Google Calendar, Gmail, and Google Health.",
    gamerscore: 25,
    category: "ai_app",
  },

  // ─── Secret ───────────────────────────────────────────────────────────────
  {
    id: "night_owl",
    title: "Night Owl",
    description: "Write a journal entry after midnight.",
    gamerscore: 10,
    category: "secret",
    secret: true,
  },
  {
    id: "early_bird",
    title: "Early Bird",
    description: "Log a health entry before 6am.",
    gamerscore: 10,
    category: "secret",
    secret: true,
  },
  {
    id: "the_completionist",
    title: "The Completionist",
    description: "Unlock 40 achievements.",
    gamerscore: 50,
    category: "secret",
    secret: true,
  },
];

export const ACHIEVEMENT_MAP = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a])
) as Record<string, AchievementDef>;

export const TOTAL_GAMERSCORE = ACHIEVEMENTS.reduce((sum, a) => sum + a.gamerscore, 0);

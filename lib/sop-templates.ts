import type { SOP } from "@/types";

// Built-in starter SOP templates. Not stored in Firestore — shown in the UI as
// "copy to my SOPs" so users can customize them. Each has a stable id prefixed "tpl_".
export const SOP_TEMPLATES: Omit<SOP, "created_at" | "updated_at">[] = [
  {
    id: "tpl_morning_startup",
    title: "Morning Startup",
    description: "Start the day with intention — review today's plan, check habits, and get focused.",
    category: "morning",
    triggerPhrases: ["run my morning routine", "morning startup", "start my day", "good morning routine"],
    steps: [
      { id: "s1", type: "reminder",  title: "Open today's briefing on the dashboard" },
      { id: "s2", type: "navigate",  title: "Go to calendar to review today's schedule" },
      { id: "s3", type: "navigate",  title: "Go to tasks and identify the 3 most important things" },
      { id: "s4", type: "question",  title: "What is your single most important outcome for today?" },
      { id: "s5", type: "navigate",  title: "Go to habits to check off morning habits" },
      { id: "s6", type: "action",    title: "Log your energy level for the morning" },
    ],
  },
  {
    id: "tpl_end_of_day",
    title: "End of Day Shutdown",
    description: "Close out the day cleanly — review what happened, capture loose ends, prep for tomorrow.",
    category: "evening",
    triggerPhrases: ["end of day", "day shutdown", "close out my day", "wrap up the day", "done for today"],
    steps: [
      { id: "s1", type: "action",    title: "Complete your day review (3 quick questions)" },
      { id: "s2", type: "navigate",  title: "Go to tasks and mark anything completed today" },
      { id: "s3", type: "question",  title: "Any new tasks or ideas to capture before closing?" },
      { id: "s4", type: "navigate",  title: "Go to calendar and check tomorrow's first event" },
      { id: "s5", type: "reminder",  title: "Clear your workspace and set out what you need for tomorrow" },
      { id: "s6", type: "action",    title: "Log your energy and activate Wind Down scene" },
    ],
  },
  {
    id: "tpl_weekly_review",
    title: "Weekly Review",
    description: "Sunday review — wins, gaps, OKR progress, and set the focus for next week.",
    category: "weekly",
    triggerPhrases: ["weekly review", "run my weekly review", "sunday review", "end of week review"],
    steps: [
      { id: "s1", type: "navigate",  title: "Go to dashboard and trigger the weekly AI review" },
      { id: "s2", type: "navigate",  title: "Go to habits and review this week's streaks" },
      { id: "s3", type: "navigate",  title: "Go to goals and update any milestone progress" },
      { id: "s4", type: "navigate",  title: "Go to OKRs and update key result progress" },
      { id: "s5", type: "navigate",  title: "Go to finance and review this week's spending" },
      { id: "s6", type: "question",  title: "What is your single focus for next week?" },
      { id: "s7", type: "action",    title: "Capture next week's top 3 tasks" },
    ],
  },
  {
    id: "tpl_monthly_finance",
    title: "Monthly Finance Review",
    description: "First-of-month finances — reconcile spending, check budget, update net worth.",
    category: "monthly",
    triggerPhrases: ["monthly finance review", "monthly review", "review my finances", "money review"],
    steps: [
      { id: "s1", type: "navigate",  title: "Go to finance and review last month's spending summary" },
      { id: "s2", type: "navigate",  title: "Go to budget tab and check which categories went over" },
      { id: "s3", type: "navigate",  title: "Go to net worth and update any manual asset values" },
      { id: "s4", type: "navigate",  title: "Go to savings goals and log any new contributions" },
      { id: "s5", type: "question",  title: "Any upcoming large expenses this month to plan around?" },
      { id: "s6", type: "action",    title: "Set or adjust budget limits for this month" },
    ],
  },
  {
    id: "tpl_quarterly_okr",
    title: "Quarterly OKR Review",
    description: "End-of-quarter reflection — score key results, capture learnings, plan next quarter.",
    category: "monthly",
    triggerPhrases: ["quarterly review", "okr review", "quarterly okr", "end of quarter"],
    steps: [
      { id: "s1", type: "navigate",  title: "Go to OKRs and review this quarter's objectives" },
      { id: "s2", type: "action",    title: "Generate AI review scores for each objective" },
      { id: "s3", type: "question",  title: "What drove the hits? What drove the misses?" },
      { id: "s4", type: "question",  title: "What should you start, stop, or continue next quarter?" },
      { id: "s5", type: "navigate",  title: "Go to goals and archive any completed goals" },
      { id: "s6", type: "action",    title: "Draft next quarter's 2-3 objectives in OKRs" },
    ],
  },
];

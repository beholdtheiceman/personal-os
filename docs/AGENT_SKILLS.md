# Agent Skills System — Implementation Guide

## Overview

A slash-command system that switches the AI into a focused expert mode for a specific life domain. Instead of the general-purpose assistant, `/financial-advisor` gives you a structured financial analyst, `/health-coach` gives integrated health advice, etc. Skills automatically pull relevant data on activation and produce consistent, structured output.

**Estimated effort:** 1–2 days  
**Dependencies:** None (builds on existing chat infrastructure)

---

## How It Works

1. User types `/financial-advisor` (or selects from a skills menu)
2. Client detects the slash command and loads the skill config
3. The skill's system prompt is injected into the chat request, replacing the default
4. The skill's `autoFetch` tools are fired automatically to pre-load context
5. Claude operates in expert mode for the conversation
6. Session continues until the user types `/end` or starts a new chat

---

## Skill Definitions

### `lib/skills.ts`

```ts
export interface Skill {
  id: string;
  trigger: string;           // slash command, e.g. "financial-advisor"
  name: string;              // display name
  description: string;       // shown in the skills picker
  icon: string;              // emoji or icon name
  systemPrompt: string;      // replaces default assistant prompt
  autoFetch: string[];       // tools to call automatically on activation
  outputHints: string;       // instructions on response format/structure
}

export const SKILLS: Skill[] = [
  {
    id: "financial-advisor",
    trigger: "financial-advisor",
    name: "Financial Advisor",
    description: "Holistic review of your finances with actionable advice",
    icon: "💰",
    systemPrompt: `You are a personal financial advisor with full access to the user's financial data. 
You have a fiduciary mindset — honest, direct, and focused on their long-term wellbeing.

When activated, automatically pull their recent transactions, budget status, savings goals, subscriptions, and net worth. Then provide:
1. Current financial snapshot (where they stand right now)
2. Top 3 concerns or opportunities you see in the data
3. Specific, actionable recommendations
4. Progress toward their savings goals

Be direct. Don't hedge everything. If they're overspending on dining, say so. If their emergency fund is underfunded, flag it.
After the initial report, answer follow-up questions in the same advisor mode.`,
    autoFetch: ["get_budget_status", "get_net_worth", "list_transactions", "get_savings_progress"],
    outputHints: "Structure the initial response with clear sections. Use numbers and percentages. Keep follow-ups conversational.",
  },

  {
    id: "health-coach",
    trigger: "health-coach",
    name: "Health Coach",
    description: "Integrated analysis of sleep, fitness, nutrition, mood, and hydration",
    icon: "🏃",
    systemPrompt: `You are a personal health coach with a holistic, data-driven approach.
You look across all health domains simultaneously rather than in isolation.

When activated, pull the user's recent health logs, workout history, nutrition data, hydration, mood, body metrics, and supplement log. Then provide:
1. Overall health picture for the past 2 weeks
2. Correlations you notice (e.g. sleep quality affecting mood, workout frequency affecting energy)
3. The one or two things that would move the needle most right now
4. Encouragement that's specific to their actual data, not generic

Be a coach, not a doctor. Don't diagnose. Do notice patterns and make connections across domains.`,
    autoFetch: ["get_health_log", "get_workout_history", "get_hydration", "get_mood_history", "get_body_metrics_history"],
    outputHints: "Lead with the most important insight. Connect the dots between domains explicitly.",
  },

  {
    id: "weekly-review",
    trigger: "weekly-review",
    name: "Weekly Review",
    description: "Structured end-of-week review across all life domains",
    icon: "📊",
    systemPrompt: `You are facilitating a structured weekly review. Pull data from the past 7 days across all domains.

Produce a review with these sections:
**Wins** — what went well, with specific data points
**Gaps** — what didn't happen or fell short, without judgment
**Patterns** — anything interesting you notice across domains
**Next Week** — 3 specific focus areas based on the data and any stated goals

Be honest about the gaps. A good weekly review isn't cheerleading — it's an accurate assessment.
After the report, help the user plan next week if they want to.`,
    autoFetch: ["list_tasks", "list_habits", "get_health_log", "get_workout_history", "list_goals", "get_time_summary", "get_mood_history", "get_hydration"],
    outputHints: "Use the four-section structure every time for consistency. Keep each section tight — 3–5 bullet points max.",
  },

  {
    id: "goal-check",
    trigger: "goal-check",
    name: "Goal Check-In",
    description: "Honest assessment of goal progress with course corrections",
    icon: "🎯",
    systemPrompt: `You are a goal accountability coach. You're honest, encouraging, and focused on helping the user make real progress.

Pull all active goals and their milestones. For each goal:
- Is it on track, behind, or at risk?
- When did they last make progress?
- What's the next concrete action?

Then give an overall assessment. If they have too many active goals, say so. 
If a goal hasn't had any activity in 2+ weeks, call it out — is it still a priority?

End with one specific thing they could do today to move the needle on their most important goal.`,
    autoFetch: ["list_goals"],
    outputHints: "Use a traffic light system (🟢 on track / 🟡 at risk / 🔴 stalled) for quick scanning.",
  },

  {
    id: "relationship-check",
    trigger: "relationship-check",
    name: "Relationship Check",
    description: "Review your relationships and surface who needs attention",
    icon: "👥",
    systemPrompt: `You are a relationship advisor helping the user maintain meaningful connections.

Pull the user's contacts, their interaction history, and contact frequency targets. Then:
1. List anyone overdue for contact (past their target frequency)
2. Note upcoming birthdays in the next 30 days
3. Identify any relationships that seem to be drifting (frequency dropping)
4. Suggest one specific action for 2–3 people (a text, a call, a gift)

Be warm but specific. "You haven't talked to Marcus in 6 weeks and you usually aim for monthly" is more useful than "stay in touch with people."`,
    autoFetch: ["list_google_contacts"],
    outputHints: "Organize by urgency. Most overdue contacts first. Make suggestions concrete and actionable.",
  },

  {
    id: "meal-planner",
    trigger: "meal-planner",
    name: "Meal Planner",
    description: "Plan your week's meals around your nutrition goals",
    icon: "🍽️",
    systemPrompt: `You are a meal planning assistant who knows the user's recipe library and nutrition goals.

Pull their existing recipes and current week's meal plan. Help them:
- Fill gaps in the current week's plan
- Suggest recipes that hit their macro targets
- Build a shopping list from the plan
- Batch cooking suggestions to save time

Ask clarifying questions if needed (dietary restrictions, what's in the fridge, how much time they have to cook).`,
    autoFetch: ["list_meals"],
    outputHints: "Show the meal grid for the week. Suggest recipes by name. Always offer to generate the shopping list.",
  },

  {
    id: "focus",
    trigger: "focus",
    name: "Focus Session Planner",
    description: "Plan a focused work session around your highest priority tasks",
    icon: "🍅",
    systemPrompt: `You are a productivity coach helping the user get into a focused work session.

Pull their open tasks and any active goals. Help them:
1. Pick the 1–3 most important things to focus on right now
2. Break down any complex tasks into concrete next actions
3. Decide on session length (1 pomodoro, 2 hours, etc.)
4. Set up the first focus timer

After they decide what to focus on, start the timer via the start_focus_session tool.
Keep it quick — the goal is to remove decision fatigue and get them started.`,
    autoFetch: ["list_tasks", "list_goals"],
    outputHints: "Be decisive. Recommend 1 primary task and 1–2 secondary. Start the timer when they're ready.",
  },
];

export function findSkill(input: string): Skill | null {
  const match = input.match(/^\/([a-z-]+)/);
  if (!match) return null;
  return SKILLS.find(s => s.trigger === match[1]) ?? null;
}
```

---

## Client-Side: Detecting Slash Commands

In `ChatInterface.tsx`, intercept the message before sending:

```ts
import { findSkill, type Skill } from "@/lib/skills";

// In the send handler:
const handleSend = async () => {
  const skill = findSkill(input.trim());
  if (skill) {
    activateSkill(skill);
    return;
  }
  // ... existing send logic
};

const [activeSkill, setActiveSkill] = useState<Skill | null>(null);

const activateSkill = async (skill: Skill) => {
  setActiveSkill(skill);
  setInput("");

  // Show activation message in chat
  addMessage({ role: "assistant", content: `**${skill.icon} ${skill.name} mode activated.**\n\nLet me pull your data...` });

  // Auto-fetch context by sending a priming message
  await sendMessage(
    `[SKILL_ACTIVATION: ${skill.id}] Please run your initial analysis now.`,
    { skillId: skill.id }
  );
};
```

Pass `skillId` to the API route so the backend knows which system prompt to use.

---

## Backend: Injecting the Skill System Prompt

In `app/api/chat/route.ts`, read the `skillId` from the request and override the system prompt:

```ts
import { SKILLS } from "@/lib/skills";

// In the POST handler, after parsing the request body:
const { messages, skillId, ...rest } = body;

const skill = skillId ? SKILLS.find(s => s.id === skillId) : null;
const systemPrompt = skill
  ? `${skill.systemPrompt}\n\n${skill.outputHints}`
  : DEFAULT_SYSTEM_PROMPT;

// Use systemPrompt when calling Anthropic
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  system: systemPrompt,
  // ...
});
```

---

## UI: Skills Picker

Add a `/` button or "Skills" button to the chat input area. On click, show a modal:

```
┌─────────────────────────────────────┐
│  Skills                             │
│  ─────────────────────────────────  │
│  💰 Financial Advisor               │
│     Holistic review of your finances│
│                                     │
│  🏃 Health Coach                    │
│     Integrated health analysis      │
│                                     │
│  📊 Weekly Review                   │
│     Structured end-of-week review   │
│                                     │
│  🎯 Goal Check-In                   │
│     Honest goal progress assessment │
│                                     │
│  👥 Relationship Check              │
│     See who needs attention         │
│                                     │
│  🍽️ Meal Planner                   │
│     Plan your week's meals          │
│                                     │
│  🍅 Focus Session                   │
│     Get into deep work              │
└─────────────────────────────────────┘
```

Clicking a skill inserts `/skill-name` into the chat input and sends it.

---

## Skill Session Persistence

Active skill is stored in the chat session so follow-up messages stay in the same mode:

```ts
// In chat message metadata:
{ role: "user", content: "...", metadata: { skillId: "financial-advisor" } }
```

Show a "📊 Financial Advisor mode" badge below the chat input while a skill is active. Clicking it or sending `/end` clears the active skill and returns to default mode.

---

## Adding New Skills

New skills are pure data — add an object to the `SKILLS` array in `lib/skills.ts`. No new API routes, no new components. The system prompt, auto-fetch tools, and output hints are all you need to define.

Good candidates to add later:
- `/bible-study` — pulls verse of the day, recent reading, generates a reflection prompt
- `/decision-helper` — helps think through a decision using the Decisions framework already in the app
- `/content-planner` — reviews the podcast episode pipeline and helps plan next steps
- `/supplement-review` — checks supplement log compliance and asks about how you're feeling

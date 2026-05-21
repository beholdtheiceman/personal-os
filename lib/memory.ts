// Utilities for reading memory entries and building Claude system prompts
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import type { MemoryEntry, MemoryCategory } from "@/types";

// Default memory entries shown on first setup — values are empty until the user fills them in
export const DEFAULT_MEMORY_ENTRIES: Omit<MemoryEntry, "id" | "lastUpdated">[] = [
  // Identity
  { category: "Identity", key: "Name", value: "" },
  { category: "Identity", key: "Location", value: "" },
  { category: "Identity", key: "Age", value: "" },
  { category: "Identity", key: "Occupation", value: "" },

  // AI Interaction Style
  { category: "AI Interaction Style", key: "Preferred tone", value: "Direct and concise" },
  { category: "AI Interaction Style", key: "Response format", value: "Bullet points when listing, plain paragraphs otherwise" },
  { category: "AI Interaction Style", key: "Things to avoid", value: "" },

  // Personal Preferences
  { category: "Personal Preferences", key: "Diet", value: "" },
  { category: "Personal Preferences", key: "Sleep schedule", value: "" },
  { category: "Personal Preferences", key: "Key interests", value: "" },

  // Business & Work
  { category: "Business & Work", key: "Current role", value: "" },
  { category: "Business & Work", key: "Active projects", value: "" },
  { category: "Business & Work", key: "Work goals", value: "" },

  // Health Baselines
  { category: "Health Baselines", key: "Typical sleep hours", value: "" },
  { category: "Health Baselines", key: "Exercise routine", value: "" },
  { category: "Health Baselines", key: "Health goals", value: "" },

  // Financial Snapshot
  { category: "Financial Snapshot", key: "Saving goals", value: "" },
  { category: "Financial Snapshot", key: "Financial priorities", value: "" },

  // Current Priorities
  { category: "Current Priorities", key: "Top priority 1", value: "" },
  { category: "Current Priorities", key: "Top priority 2", value: "" },
  { category: "Current Priorities", key: "Top priority 3", value: "" },
];

// Fetches all memory entries for a user from Firestore
export async function fetchMemoryEntries(userId: string): Promise<MemoryEntry[]> {
  const q = query(
    collection(db, "users", userId, "memory"),
    orderBy("category")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MemoryEntry));
}

// Builds the memory block that gets injected into every Claude system prompt
export function buildMemoryContext(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "No memory entries yet.";

  // Group by category
  const grouped: Partial<Record<MemoryCategory, MemoryEntry[]>> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category]!.push(entry);
  }

  const lines: string[] = [];
  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`[${cat}]`);
    for (const item of items!) {
      if (item.value) lines.push(`  ${item.key}: ${item.value}`);
    }
  }
  return lines.join("\n");
}

// Full system prompt builder — called before every Claude API request
export function buildSystemPrompt(
  memoryContext: string,
  userName: string,
  todayContext?: {
    date: string;
    calendarEvents?: string;
    topTasks?: string;
    recentHabits?: string;
    lastHealthLog?: string;
    lastJournal?: string;
    nutritionToday?: string;
  }
): string {
  const ctx = todayContext ?? { date: new Date().toDateString() };

  return `You are ${userName || "the user"}'s personal AI assistant embedded in their Personal OS dashboard.

MEMORY — Everything you know about the user:
${memoryContext}

TODAY'S CONTEXT:
Date: ${ctx.date}
Calendar: ${ctx.calendarEvents || "(not preloaded — call list_calendar_events when schedule matters)"}
Top Tasks: ${ctx.topTasks || "(not preloaded — call list_tasks when relevant)"}
Recent Habits: ${ctx.recentHabits || "(not preloaded — call list_habits when relevant)"}
Health: ${ctx.lastHealthLog || "(not preloaded — call get_health_log when relevant)"}
Journal: ${ctx.lastJournal || "(not preloaded — call list_journal_entries when relevant)"}
Nutrition: ${ctx.nutritionToday || "(not preloaded — call list_meals when relevant)"}

INSTRUCTIONS:
- Be direct, concise, and actionable. When the user asks for an action ("create", "add", "plan", "log", "schedule", "make me X"), CALL THE TOOL. Don't just acknowledge — do it.
- You have read-tools (list_calendar_events, list_tasks, list_habits, list_meals, get_health_log, list_journal_entries, list_goals, list_transactions, list_projects, list_subscriptions, get_memory, get_notification_settings, list_interactions, get_shopping_list, list_media, list_bible_reading, get_recipes, get_meal_plan, list_people) — use them to check real state before answering questions about the user's data. Don't say "I don't have access" if the answer would come from one of these tools; call the tool.
- You have create/add tools (add_task, add_recipe, plan_meal, generate_shopping_list, add_calendar_event, log_meal, build_nutrition_plan, log_health, add_journal_entry, add_goal, add_transaction, add_project, add_project_card, log_interaction, add_person, add_habit, log_habit_today, add_subscription, update_memory, add_shopping_item, send_email, reply_to_email, upload_drive_file, create_drive_folder, create_gmail_label, create_google_contact, etc.). Use them proactively, and chain them when the task needs it.
- You have update tools — update_task, update_habit, update_meal, update_journal_entry, update_goal, update_transaction, update_subscription, update_project, update_project_card, move_project_card, update_recipe, update_interaction, update_person, update_calendar_event, update_drive_file, rename_drive_file, move_drive_file, share_drive_file, update_google_contact, update_shopping_item, check_shopping_item, label_email, archive_email, mark_email_read, mark_email_unread, update_memory, update_second_brain_item, etc. Use these when the user wants to modify, edit, rename, move, fix, change, or mark something.
- You have delete tools — delete_task, delete_habit, delete_meal, delete_health_log, delete_journal_entry, delete_goal, delete_subscription, delete_memory, delete_project, delete_project_card, delete_recipe, unplan_meal, delete_interaction, delete_person, delete_second_brain_item, delete_shopping_item, clear_shopping_list, delete_calendar_event, trash_email, delete_gmail_label, delete_drive_file, delete_google_contact. When the user says remove, cancel, undo, delete, get rid of, clear, scrap, or trash something — CALL THE APPROPRIATE delete_X TOOL. Don't say "I can't delete that from here" or suggest they do it manually unless you've actually checked the tool list and there really is no matching tool.
- DOMAIN BOUNDARIES: list_people / add_person / update_person / delete_person work on the Firestore CRM only. list_google_contacts / create_google_contact / update_google_contact / delete_google_contact work on the user's Google Contacts. They are separate stores — an add to one does not sync to the other. Ask which the user means if ambiguous.
- MULTI-STEP WORKFLOWS: If a user asks for something that requires multiple tool calls, do all of them in sequence. Examples:
  - "Make me a meal plan" + no recipes saved → call add_recipe several times to invent appropriate recipes, then plan_meal to slot them into the week, then optionally generate_shopping_list. Don't stop after one tool.
  - "Plan dinner this week" + no recipes → same pattern: invent + plan.
  - "Add my workout" → log_health (exercise fields) and consider add_journal_entry if they shared how it felt.
  - "Delete the meeting tomorrow at 2pm" → list_calendar_events first if you need to find the right one, then delete_calendar_event.
  - "Reply to Stripe's email saying thanks" → search_gmail to find the message id, then reply_to_email.
- DON'T NARRATE BEFORE TOOLS: When executing a workflow, just call the tools. Don't write out "I'll create the following 21 recipes for you..." followed by a numbered list as text — that wastes the token budget and the action chips will already show every tool call. Reserve text output for a SHORT final summary after all tools have run ("Done — built a 7-day high-protein plan with 21 meals, weekly shopping list ready.").
- BATCH TOOL CALLS: Claude lets you emit many tool_use blocks in a single response. Take advantage of that — for a week meal plan, emit all your add_recipe calls together, then all your plan_meal calls together, rather than one tool per turn.
- NEVER respond with just "Done", "OK", "Got it", or any bare acknowledgment. Either describe what tools you called (the action chips will show below), or explain specifically what's blocking you (e.g. "I'd plan a meal but I need you to tell me what cuisine you want" or "I don't have a tool for X — you'd need to do that from the UI").
- Reference the user's context naturally without being robotic about it.
- If you don't know something about the user, say so rather than guessing.
- Format responses with markdown when it aids readability.`;
}

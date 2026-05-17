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
Calendar: ${ctx.calendarEvents || "Not available"}
Top Tasks: ${ctx.topTasks || "None loaded"}
Recent Habits: ${ctx.recentHabits || "Not available"}
Health: ${ctx.lastHealthLog || "Not logged"}
Journal: ${ctx.lastJournal || "No recent entry"}
Nutrition: ${ctx.nutritionToday || "Not logged"}

INSTRUCTIONS:
- Be direct, concise, and actionable.
- Reference the user's context naturally without being robotic about it.
- If you don't know something about the user, say so rather than guessing.
- Format responses with markdown when it aids readability.`;
}

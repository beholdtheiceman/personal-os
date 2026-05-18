// ─── User ────────────────────────────────────────────────────────────────────
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// ─── Memory ───────────────────────────────────────────────────────────────────
export type MemoryCategory =
  | "Identity"
  | "AI Interaction Style"
  | "Personal Preferences"
  | "Business & Work"
  | "Health Baselines"
  | "Financial Snapshot"
  | "Current Priorities";

export interface MemoryEntry {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  lastUpdated: string; // ISO string
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export type TaskStatus = "active" | "completed" | "archived";
export type TaskTag = "personal" | "business" | "health" | "finance";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority_score: number;
  tags: TaskTag[];
  due_date: string | null;
  created_at: string;
  source: "manual" | "voice" | "ai";
}

// ─── Habits ───────────────────────────────────────────────────────────────────
export interface Habit {
  id: string;
  name: string;
  category: string;
  target_days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  completions: string[]; // array of "YYYY-MM-DD" date strings
  reminder_enabled?: boolean;
  reminder_times?: string[];  // ["08:00", "12:00", "18:00"] in user's local timezone
  reminder_timezone?: string; // e.g. "America/New_York"
  /** @deprecated use reminder_times */ reminder_time?: string;
}

// ─── Journal ──────────────────────────────────────────────────────────────────
export interface JournalEntry {
  id: string;
  date: string;
  raw_transcript: string;
  ai_summary: string;
  mood_score: number;
  tags: string[];
  created_at: string;
}

// ─── Nutrition ────────────────────────────────────────────────────────────────
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface NutritionLog {
  id: string;
  date: string;
  meal: MealType;
  description: string;
  calories_estimated: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_at: string;
}

// ─── Health ───────────────────────────────────────────────────────────────────
export interface HealthLog {
  id: string;
  date: string;
  sleep_hours: number;
  sleep_quality: number;
  exercise_done: boolean;
  exercise_description: string;
  energy_level: number;
  notes: string;
  logged_at: string;
}

// ─── Goals ────────────────────────────────────────────────────────────────────
export type GoalCategory = "personal" | "business" | "health" | "financial";
export type GoalStatus = "active" | "achieved" | "paused";

export interface GoalMilestone {
  title: string;
  completed: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  target_date: string;
  milestones: GoalMilestone[];
  status: GoalStatus;
  created_at: string;
}

// ─── Finance ──────────────────────────────────────────────────────────────────
export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  source: "manual" | "google-sheets";
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export type ProjectStatus = "active" | "on-hold" | "completed";
export type KanbanStatus = "todo" | "in_progress" | "done";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  color_tag: string;
  created_at: string;
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  status: KanbanStatus;
  priority: "low" | "medium" | "high";
  created_at: string;
}

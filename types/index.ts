// ─── People / Relationships CRM ──────────────────────────────────────────────
export type RelationshipType = "friend" | "family" | "colleague" | "acquaintance" | "other";
export type ContactFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type InteractionType = "call" | "text" | "email" | "in-person" | "social" | "other";

export interface Person {
  id: string;
  name: string;
  relationship: RelationshipType;
  email?: string;
  phone?: string;
  birthday?: string;       // YYYY-MM-DD
  location?: string;
  company?: string;
  notes?: string;
  tags?: string[];
  gift_ideas?: string[];
  last_contacted?: string; // YYYY-MM-DD
  contact_frequency?: ContactFrequency;
  follow_up_date?: string; // YYYY-MM-DD
  follow_up_note?: string;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  person_id: string;
  date: string;            // YYYY-MM-DD
  type: InteractionType;
  notes?: string;
  created_at: string;
}

// ─── Quick Links ─────────────────────────────────────────────────────────────
export interface QuickLink {
  id: string;
  title: string;
  url: string;
  emoji?: string; // optional override; otherwise auto-favicon
}

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
export type RecurrenceCadence = "daily" | "weekly" | "monthly";

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
  recurrence?: RecurrenceCadence | null;
  recurrence_end?: string | null; // YYYY-MM-DD; stop recurring after this date
  parent_task_id?: string | null; // links recurring instances back to the first task
  recurrence_spawned?: boolean;   // guards against spawning the successor twice on re-completion
}

// ─── Notifications ────────────────────────────────────────────────────────────
export interface NotificationCategory {
  enabled: boolean;
  time?: string;       // "HH:mm" local time
  timezone?: string;
  days_before?: number; // for deadline-based alerts
  day_of_week?: number; // 0=Sun for weekly review
}

export interface NotificationSettings {
  morning_briefing: NotificationCategory;
  streak_alert: NotificationCategory;
  task_reminder: NotificationCategory;
  goal_deadline: NotificationCategory;
  journal_reminder: NotificationCategory;
  health_reminder: NotificationCategory;
  weekly_review: NotificationCategory;
  birthday_reminder: NotificationCategory;  // days_before used instead of time
  savings_milestone: NotificationCategory;  // fires when crossing 25/50/75/100%
  progress_midday: NotificationCategory;    // mid-day check: water, habits, steps, nutrition, workout
  progress_evening: NotificationCategory;   // evening check: same targets, more urgency
  decision_review: NotificationCategory;    // fires when decisions have pending_review && review_date <= today
  networth_reminder: NotificationCategory;  // fires on 1st of month if no snapshot logged yet
  time_summary: NotificationCategory;       // end-of-day summary of tracked time
  goal_inactivity: NotificationCategory;    // weekly nudge when an active goal has had no activity in 14+ days
  subscription_renewal: NotificationCategory; // fires days_before next_billing_date
  spending_trend: NotificationCategory;     // mid-month alert when pace projects overspend on a budget category
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  morning_briefing:  { enabled: false, time: "07:00" },
  streak_alert:      { enabled: false, time: "20:00" },
  task_reminder:     { enabled: false, time: "09:00" },
  goal_deadline:     { enabled: false, days_before: 3 },
  journal_reminder:  { enabled: false, time: "21:00" },
  health_reminder:   { enabled: false, time: "20:00" },
  weekly_review:     { enabled: false, time: "09:00", day_of_week: 0 },
  birthday_reminder: { enabled: false, time: "08:00", days_before: 7 },
  savings_milestone: { enabled: false },
  progress_midday:   { enabled: false, time: "13:00" },
  progress_evening:  { enabled: false, time: "18:00" },
  decision_review:   { enabled: false, time: "09:00" },
  networth_reminder: { enabled: false },
  time_summary:         { enabled: false, time: "21:00" },
  goal_inactivity:      { enabled: false },
  subscription_renewal: { enabled: false, time: "09:00", days_before: 3 },
  spending_trend:       { enabled: false, time: "12:00" },
};

// Deep-merges a stored settings doc onto the defaults. A shallow spread
// ({ ...DEFAULT, ...stored }) lets a partial stored category — e.g.
// progress_midday: { enabled: true } with no time — clobber the default's
// time, leaving time undefined and silently disabling the notification.
export function mergeNotificationSettings(
  stored: Record<string, unknown> | undefined | null
): NotificationSettings {
  const defaults = DEFAULT_NOTIFICATION_SETTINGS as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(stored ?? {})) {
    const def = defaults[key];
    out[key] =
      def && typeof def === "object" && value && typeof value === "object" && !Array.isArray(value)
        ? { ...(def as object), ...(value as object) }
        : value;
  }
  return out as unknown as NotificationSettings;
}

// ─── XP / Gamification ───────────────────────────────────────────────────────
export type XPEventType =
  | "habit_complete"
  | "task_complete"
  | "journal_entry"
  | "health_log"
  | "goal_milestone"
  | "goal_complete"
  | "streak_bonus"
  | "hydration_goal"
  | "workout_complete"
  | "mood_logged";

export interface XPEvent {
  id: string;
  type: XPEventType;
  xp: number;
  description: string;
  timestamp: string;
}

export interface UserXP {
  total: number;
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

// ─── Hydration ───────────────────────────────────────────────────────────────
export interface HydrationLog {
  date: string;        // YYYY-MM-DD (also the Firestore doc ID)
  glasses: number;
  goal: number;        // default 8
  logs: string[];      // ISO timestamps of each glass logged
  updated_at: string;
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
  readiness_score?: number; // 0-100, computed from RHR trend + sleep history + HRV
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
  source: "manual" | "google-sheets" | "email-agent" | "plaid";
  pending?: boolean;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
export type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus = "active" | "cancelled" | "paused";
export type SubscriptionCategory =
  | "Entertainment" | "Productivity" | "Health & Fitness"
  | "Finance" | "Utilities" | "Food & Drink" | "Gaming"
  | "News & Media" | "Shopping" | "Other";

export interface Subscription {
  id: string;
  name: string;
  category: SubscriptionCategory;
  amount: number;
  billing_cycle: BillingCycle;
  next_billing_date: string;   // YYYY-MM-DD
  start_date: string;          // YYYY-MM-DD
  status: SubscriptionStatus;
  url?: string;
  notes?: string;
  plaid_stream_id?: string;    // linked Plaid recurring stream
  source?: "manual" | "email-agent";
  tmdbProviderId?: number;     // Set for known streaming services; drives content browsing
  created_at: string;
}

// ─── Subscription Watchlist ───────────────────────────────────────────────────
export interface WatchlistItem {
  id: string;
  titleId: number;           // TMDb ID
  subscriptionId: string;    // links back to users/{uid}/subscriptions/{id}
  title: string;
  poster: string | null;     // full TMDb image URL (pre-resolved, not just path)
  media_type: 'movie' | 'tv';
  added_at: string;          // ISO timestamp
}

// ─── Email Agent ──────────────────────────────────────────────────────────────

export interface AgentRunStats {
  subscriptions_added: number;
  transactions_added: number;
  last_week_count: number;
  week_start: string; // YYYY-MM-DD — reset when > 7 days old
}

export interface GmailAgentRun {
  last_run_at: string;       // ISO timestamp
  last_history_id: string;   // Gmail History API checkpoint; "" on first run
  processed_ids: string[];   // rolling window of last 500 message IDs
  stats: AgentRunStats;
  last_error?: string;
  last_error_at?: string;
}

export interface EmailMeta {
  id: string;
  subject: string;
  from: string;
  snippet: string;
}

// ─── Meal Planner ─────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  name: string;
  amount: string; // e.g. "2 cups", "1 lb"
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings: number;
  prep_time_min?: number;
  cook_time_min?: number;
  ingredients: RecipeIngredient[];
  instructions?: string;
  tags?: string[];
  calories_per_serving?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  created_at: string;
}

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealPlanEntry {
  recipe_id: string;
  recipe_name: string;
  servings: number;
}

export interface MealPlanDay {
  breakfast?: MealPlanEntry;
  lunch?: MealPlanEntry;
  dinner?: MealPlanEntry;
  snack?: MealPlanEntry;
}

export interface MealPlan {
  id: string;
  week_start: string; // YYYY-MM-DD (Monday)
  days: Record<string, MealPlanDay>; // keyed by YYYY-MM-DD
  created_at: string;
}

export interface ShoppingListItem {
  ingredient: string;
  amount: string;
  checked: boolean;
}

export interface ShoppingList {
  id: string;
  week_start: string;
  items: ShoppingListItem[];
  generated_at: string;
}

// ─── Timezone ─────────────────────────────────────────────────────────────────
export interface TimezoneSettings {
  current_timezone: string; // auto-updated from device on each visit
  home_timezone: string;    // user-chosen fixed timezone (ignores travel)
  updated_at: string;
}

// ─── Daily Briefing ───────────────────────────────────────────────────────────
export interface DailyBriefing {
  date: string;           // YYYY-MM-DD (also the doc ID)
  content: string;        // Claude's markdown briefing
  generated_at: string;   // ISO timestamp
  calendar_events: number;
  tasks_flagged: number;
  habits_due: number;
}

// ─── Decision Journal ─────────────────────────────────────────────────────────
export type DecisionStatus = "pending_review" | "reviewed";

export interface Decision {
  id: string;
  title: string;
  date: string;                   // YYYY-MM-DD — when decision was made
  context: string;
  options_considered: string[];
  chosen_option: string;
  reasoning: string;
  expected_outcome: string;
  review_date: string;            // YYYY-MM-DD — when to revisit
  review_notes?: string;
  outcome_rating?: number;        // 1–5
  status: DecisionStatus;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

// ─── Time Tracker ─────────────────────────────────────────────────────────────
export type TimeCategory = "work" | "personal" | "health" | "learning" | "other";
export type TimeSource = "manual" | "timer";

export interface TimeEntry {
  id: string;
  date: string;            // YYYY-MM-DD
  start_time: string;      // ISO timestamp
  end_time: string;        // ISO timestamp
  duration_min: number;
  description: string;
  task_id?: string;
  project_id?: string;
  category: TimeCategory;
  source: TimeSource;
  created_at: string;
}

// ─── Workout ──────────────────────────────────────────────────────────────────
export type ExerciseCategory = "push" | "pull" | "legs" | "core" | "cardio" | "other";
export type WeightUnit = "lbs" | "kg";

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  pr_weight?: number;
  pr_reps?: number;
  pr_date?: string;
  created_at: string;
}

export interface WorkoutSet {
  reps: number;
  weight: number;
  unit: WeightUnit;
}

export interface WorkoutExercise {
  exercise_id: string;
  exercise_name: string;
  sets: WorkoutSet[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  date: string;         // YYYY-MM-DD
  name: string;
  exercises: WorkoutExercise[];
  duration_min?: number;
  notes?: string;
  created_at: string;
}

export interface WorkoutPlanDay {
  day: string;          // e.g. "Monday"
  focus: string;        // e.g. "Push Day"
  exercises: string[];  // exercise names
}

export interface WorkoutPlan {
  id: string;
  name: string;
  days: WorkoutPlanDay[];
  created_at: string;
}

// ─── Budget ───────────────────────────────────────────────────────────────────
export interface BudgetCategory {
  limit: number;
  alert_threshold: number; // 0–1, default 0.8
}

export interface BudgetMonth {
  categories: Record<string, BudgetCategory>;
  created_at: string;
}

// ─── Net Worth ────────────────────────────────────────────────────────────────
export type AssetCategory = "cash" | "investment" | "property" | "other";
export type LiabilityCategory = "loan" | "credit_card" | "mortgage" | "other";

export interface AssetEntry {
  value: number;
  category: AssetCategory;
}

export interface LiabilityEntry {
  value: number;
  category: LiabilityCategory;
}

export interface NetWorthSnapshot {
  assets: Record<string, AssetEntry>;
  liabilities: Record<string, LiabilityEntry>;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  snapshot_date: string; // YYYY-MM (also doc ID)
  created_at: string;
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

// ─── Podcast / Content Tracker ───────────────────────────────────────────────
export type EpisodeStatus = "idea" | "outlined" | "recorded" | "edited" | "published";

export interface EpisodeLink {
  label: string;
  url: string;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  episode_number?: number;
  status: EpisodeStatus;
  record_date?: string;    // YYYY-MM-DD
  publish_date?: string;   // YYYY-MM-DD
  description?: string;
  notes?: string;
  tags?: string[];
  links?: EpisodeLink[];
  created_at: string;
  updated_at: string;
}

// ─── Reading List / Book Tracker ──────────────────────────────────────────────
export type BookStatus = "want_to_read" | "reading" | "finished" | "abandoned";

export interface Book {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  start_date?: string;    // YYYY-MM-DD
  finish_date?: string;   // YYYY-MM-DD
  rating?: number;        // 1–5
  highlights: string[];
  takeaways?: string;     // Claude summary or manual
  cover_url?: string;
  url?: string;
  tags?: string[];
  order?: number;
  created_at: string;
  updated_at: string;
}

// ─── Mood Tracker ─────────────────────────────────────────────────────────────
export interface MoodEntry {
  id: string;
  date: string;       // YYYY-MM-DD (also doc ID)
  score: number;      // 1–10
  note?: string;
  logged_at: string;
}

// ─── Body Metrics ─────────────────────────────────────────────────────────────
export interface BodyMetricsEntry {
  id: string;
  date: string;       // YYYY-MM-DD (also doc ID)
  weight_lbs?: number;
  body_fat_pct?: number;
  chest_in?: number;
  waist_in?: number;
  hips_in?: number;
  arms_in?: number;
  notes?: string;
  logged_at: string;
}

// ─── Savings Goals ────────────────────────────────────────────────────────────
export interface SavingsContribution {
  amount: number;
  date: string;       // YYYY-MM-DD
  note?: string;
}

export type SavingsGoalStatus = "active" | "completed" | "paused";

export interface SavingsGoal {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string;    // YYYY-MM-DD
  contributions: SavingsContribution[];
  color?: string;
  status: SavingsGoalStatus;
  created_at: string;
  updated_at: string;
}

// ─── Supplement / Medication Log ─────────────────────────────────────────────
export type SupplementTiming = "morning" | "afternoon" | "evening" | "with_meals" | "before_bed";

export interface Supplement {
  id: string;
  name: string;
  dosage: string;           // e.g. "1000mg", "2 capsules"
  timing: SupplementTiming;
  notes?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplementLog {
  date: string;             // YYYY-MM-DD, used as doc ID
  taken: string[];          // supplement IDs checked off today
  logged_at: string;
}

// ─── Proactive AI Insights ───────────────────────────────────────────────────
export interface AIInsight {
  id: string;               // YYYY-MM-DD
  date: string;
  content: string;          // Markdown insight text from Claude
  data_sources: string[];   // which data streams had data
  generated_at: string;
}

// ─── Achievements ─────────────────────────────────────────────────────────────
export type AchievementCategory =
  | "tasks"
  | "habits"
  | "health"
  | "journal"
  | "goals_finance"
  | "reading"
  | "people"
  | "ai_app"
  | "secret";

export type AchievementId =
  // Tasks
  | "first_blood" | "triple_digits" | "the_machine" | "ahead_of_the_curve"
  // Habits
  | "creature_of_habit" | "week_one" | "the_long_game" | "unbreakable" | "perfect_day"
  // Health
  | "body_check" | "ten_k_club" | "full_tank" | "sweat_equity" | "pr_breaker" | "century_club"
  // Journal
  | "dear_diary" | "stream_of_consciousness" | "thirty_days_of_truth"
  // Goals & Finance
  | "milestone_reached" | "goal_digger" | "in_the_black" | "nest_egg"
  // Reading
  | "page_turner" | "bibliophile" | "highlight_reel"
  // People
  | "social_network" | "never_forget" | "people_person"
  // AI & App
  | "hello_world" | "power_user" | "capture_artist" | "connected"
  // Secret
  | "night_owl" | "early_bird" | "the_completionist";

export interface AchievementDef {
  id: AchievementId;
  title: string;
  description: string;
  gamerscore: number;
  category: AchievementCategory;
  secret?: boolean;
}

export interface AchievementUnlock {
  id: AchievementId;
  unlockedAt: string;   // ISO
  gamerscore: number;
}

// ─── News Feed ────────────────────────────────────────────────────────────────
export type NewsItemStatus = "unread" | "read" | "saved" | "dismissed";
export type NewsFeedType   = "rss" | "reddit";

export interface NewsFeed {
  id: string;
  name: string;
  url: string;
  type: NewsFeedType;
  tags: string[];
  enabled: boolean;
  created_at: string;
}

export interface NewsItem {
  id: string;                // base64(feedId + "|" + url)
  feed_id: string;
  feed_name: string;
  title: string;
  url: string;
  description: string;
  published_at: string;      // ISO
  fetched_at: string;        // ISO
  tags: string[];
  relevance_score: number;   // 1–10
  status: NewsItemStatus;
  starred?: boolean;
  saved_at?: string;         // ISO, set when status → "saved"
}

export interface NewsBrief {
  date: string;             // YYYY-MM-DD (also doc ID)
  summary: string;          // 4-5 sentence plain prose
  sources: { title: string; url: string }[];
  generated_at: string;     // ISO
  article_count: number;
}

// ─── Weather ──────────────────────────────────────────────────────────────────
export interface WeatherSettings {
  latitude: number;
  longitude: number;
  city: string;
  units: "fahrenheit" | "celsius";
  updated_at: string;
}

export interface WeatherCurrent {
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  weather_code: number;
  condition: string;
  uv_index: number;
}

export interface WeatherHourly {
  time: string;
  temp: number;
  weather_code: number;
  condition: string;
  precip_probability: number;
}

export interface WeatherDay {
  date: string;
  weather_code: number;
  condition: string;
  temp_max: number;
  temp_min: number;
  precip_sum: number;
  uv_index_max: number;
}

export interface WeatherResponse {
  city: string;
  units: "fahrenheit" | "celsius";
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDay[];
  fetched_at: string;
}

// ─── Personal Constitution ────────────────────────────────────────────────────
export interface ConstitutionMessage {
  role: "guide" | "user";
  content: string;
}

export interface PersonalConstitution {
  content: string;                      // Full formatted text injected into chat context
  interview_messages: ConstitutionMessage[]; // Full conversation history
  interview_complete: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Life Season ──────────────────────────────────────────────────────────────
export interface SeasonMessage {
  role: "guide" | "user";
  content: string;
}

export interface LifeSeason {
  name: string;
  intention: string;
  claude_framing: string;
  messages: SeasonMessage[];
  checkin_complete: boolean;
  started_at: string;    // YYYY-MM-DD
  status: "active" | "closing";
}

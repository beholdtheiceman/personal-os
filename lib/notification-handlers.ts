// Notification handler functions — one per category.
// Each returns { title, body } or null if nothing to send.
import { getAdminDb } from "./firebase-admin";

interface NotifPayload { title: string; body: string; tag?: string; }

function localNow(tz: string) {
  return new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
}

function todayLocal(tz: string) {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
}

// ── Morning Briefing ──────────────────────────────────────────────────────────
export async function morningBriefingHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const today = todayLocal(tz);

  const [habitsSnap, tasksSnap] = await Promise.all([
    db.collection(`users/${uid}/habits`).get(),
    db.collection(`users/${uid}/tasks`).where("status", "==", "active").get(),
  ]);

  const habitsTotal = habitsSnap.size;
  const habitsDone = habitsSnap.docs.filter((d) => (d.data().completions as string[] ?? []).includes(today)).length;
  const tasksDueToday = tasksSnap.docs.filter((d) => d.data().due_date === today).length;
  const overdue = tasksSnap.docs.filter((d) => d.data().due_date && d.data().due_date < today).length;

  const parts: string[] = [];
  if (habitsTotal > 0) parts.push(`${habitsDone}/${habitsTotal} habits done`);
  if (tasksDueToday > 0) parts.push(`${tasksDueToday} task${tasksDueToday > 1 ? "s" : ""} due today`);
  if (overdue > 0) parts.push(`${overdue} overdue`);

  return {
    title: "☀️ Good morning",
    body: parts.length > 0 ? parts.join(" · ") : "Have a great day!",
    tag: "morning-briefing",
  };
}

// ── Streak Alert ──────────────────────────────────────────────────────────────
export async function streakAlertHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const today = todayLocal(tz);
  const todayDay = localNow(tz).getDay();

  const habitsSnap = await db.collection(`users/${uid}/habits`).get();
  const atRisk = habitsSnap.docs.filter((d) => {
    const habit = d.data();
    const targetDays: number[] = habit.target_days ?? [0,1,2,3,4,5,6];
    if (!targetDays.includes(todayDay)) return false;
    const completions: string[] = habit.completions ?? [];
    if (completions.includes(today)) return false;
    // Has a streak (completed yesterday)
    const yesterday = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toLocaleDateString("en-CA", { timeZone: tz });
    return completions.includes(yStr);
  });

  if (atRisk.length === 0) return null;

  const names = atRisk.slice(0, 2).map((d) => d.data().name as string);
  const more = atRisk.length > 2 ? ` +${atRisk.length - 2} more` : "";

  return {
    title: "🔥 Streak at risk",
    body: `Don't break your streak: ${names.join(", ")}${more}`,
    tag: "streak-alert",
  };
}

// ── Task Reminder ─────────────────────────────────────────────────────────────
export async function taskReminderHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const today = todayLocal(tz);
  const tomorrow = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: tz });

  const snap = await db.collection(`users/${uid}/tasks`)
    .where("status", "==", "active")
    .get();

  const dueToday = snap.docs.filter((d) => d.data().due_date === today);
  const overdue = snap.docs.filter((d) => d.data().due_date && d.data().due_date < today);

  if (dueToday.length === 0 && overdue.length === 0) return null;

  const parts: string[] = [];
  if (dueToday.length > 0) parts.push(`${dueToday.length} due today`);
  if (overdue.length > 0) parts.push(`${overdue.length} overdue`);

  return {
    title: "✅ Task reminder",
    body: parts.join(", ") + " — check your task list",
    tag: "task-reminder",
  };
}

// ── Goal Deadline ─────────────────────────────────────────────────────────────
export async function goalDeadlineHandler(uid: string, tz: string, daysBefore = 3): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const now = localNow(tz);
  const snap = await db.collection(`users/${uid}/goals`).where("status", "==", "active").get();

  const approaching = snap.docs.filter((d) => {
    const target = d.data().target_date as string | undefined;
    if (!target) return false;
    const daysUntil = Math.ceil((new Date(target).getTime() - now.getTime()) / 86400000);
    return daysUntil >= 0 && daysUntil <= daysBefore;
  });

  if (approaching.length === 0) return null;

  const names = approaching.slice(0, 2).map((d) => d.data().title as string);
  return {
    title: "🎯 Goal deadline approaching",
    body: `${names.join(", ")} ${approaching.length === 1 ? "is" : "are"} due soon`,
    tag: "goal-deadline",
  };
}

// ── Journal Reminder ──────────────────────────────────────────────────────────
export async function journalReminderHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const today = todayLocal(tz);
  const snap = await db.collection(`users/${uid}/journal`).where("date", "==", today).limit(1).get();
  if (!snap.empty) return null; // already journaled today

  return {
    title: "📓 Journal reminder",
    body: "Take a moment to reflect on your day",
    tag: "journal-reminder",
  };
}

// ── Health Reminder ───────────────────────────────────────────────────────────
export async function healthReminderHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const today = todayLocal(tz);
  const doc = await db.doc(`users/${uid}/health/${today}`).get();
  if (doc.exists) return null; // already logged today

  return {
    title: "💪 Health log reminder",
    body: "Log your sleep, energy, and activity for today",
    tag: "health-reminder",
  };
}

// ── Weekly Review ─────────────────────────────────────────────────────────────
export async function weeklyReviewHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  // Check it's the right day of week
  const today = localNow(tz).getDay(); // 0 = Sunday
  if (today !== 0) return null; // only Sundays by default (caller can override)

  const db = getAdminDb();
  const weekAgo = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [habitsSnap, tasksSnap] = await Promise.all([
    db.collection(`users/${uid}/habits`).get(),
    db.collection(`users/${uid}/tasks`).where("status", "==", "completed").get(),
  ]);

  const completedTasks = tasksSnap.docs.filter((d) => {
    const ts = d.data().updated_at as string | undefined;
    return ts && new Date(ts) > weekAgo;
  }).length;

  const totalHabits = habitsSnap.size;
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString("en-CA", { timeZone: tz });
  });
  const avgCompletion = totalHabits > 0
    ? Math.round(habitsSnap.docs.reduce((sum, d) => {
        const completions: string[] = d.data().completions ?? [];
        return sum + dates.filter((date) => completions.includes(date)).length;
      }, 0) / totalHabits * 100 / 7)
    : 0;

  return {
    title: "📊 Weekly Review",
    body: `${completedTasks} tasks done · ${avgCompletion}% habit completion this week`,
    tag: "weekly-review",
  };
}

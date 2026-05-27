// Notification handler functions — one per category.
// Each returns { title, body } or null if nothing to send.
import { getAdminDb } from "./firebase-admin";
import { format, parseISO, differenceInDays } from "date-fns";
import type { Subscription, BillingCycle } from "@/types";

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
  const todayStr = todayLocal(tz);
  const snap = await db.collection(`users/${uid}/goals`).where("status", "==", "active").get();

  const approaching = snap.docs.filter((d) => {
    const target = d.data().target_date as string | undefined;
    if (!target) return false;
    const daysUntil = Math.ceil((new Date(target + "T00:00:00Z").getTime() - now.getTime()) / 86400000);
    return daysUntil >= 0 && daysUntil <= daysBefore;
  });

  if (approaching.length === 0) return null;

  // Dedup: only notify for goals not already notified today
  const sentDoc = await db.doc(`users/${uid}/notification_sent/goal_deadline_${todayStr}`).get();
  const alreadySent: string[] = sentDoc.exists ? (sentDoc.data()?.ids as string[]) ?? [] : [];
  const newOnes = approaching.filter((d) => !alreadySent.includes(d.id));
  if (newOnes.length === 0) return null;

  await db.doc(`users/${uid}/notification_sent/goal_deadline_${todayStr}`).set(
    { ids: [...alreadySent, ...newOnes.map((d) => d.id)] },
    { merge: true }
  );

  const lines = newOnes.slice(0, 2).map((d) => {
    const target = d.data().target_date as string;
    const daysUntil = Math.ceil((new Date(target + "T00:00:00Z").getTime() - now.getTime()) / 86400000);
    return `${d.data().title as string} (${daysUntil === 0 ? "today" : `${daysUntil}d left`})`;
  });
  return {
    title: "🎯 Goal deadline approaching",
    body: lines.join(", ") + (newOnes.length > 2 ? ` +${newOnes.length - 2} more` : ""),
    tag: "goal-deadline",
  };
}

// ── Savings Milestone ─────────────────────────────────────────────────────────
export async function savingsMilestoneHandler(uid: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const snap = await db.collection(`users/${uid}/savings_goals`)
    .where("status", "==", "active").get();
  if (snap.empty) return null;

  const MILESTONES = [25, 50, 75, 100];
  const hits: { name: string; milestone: number }[] = [];

  for (const goalDoc of snap.docs) {
    const data = goalDoc.data();
    const pct = data.target_amount > 0
      ? Math.min(100, (data.current_amount as number / (data.target_amount as number)) * 100)
      : 0;

    // Check which milestone was last notified
    const sentRef = db.doc(`users/${uid}/notification_sent/savings_milestone_${goalDoc.id}`);
    const sentDoc = await sentRef.get();
    const lastMilestone: number = sentDoc.exists ? (sentDoc.data()?.last_milestone as number) ?? 0 : 0;

    for (const m of MILESTONES) {
      if (pct >= m && lastMilestone < m) {
        hits.push({ name: data.name as string, milestone: m });
        await sentRef.set({ last_milestone: m }, { merge: true });
        break; // Only fire one milestone per goal per check
      }
    }
  }

  if (hits.length === 0) return null;

  if (hits.length === 1) {
    const { name, milestone } = hits[0];
    const emoji = milestone === 100 ? "🎉" : milestone >= 75 ? "🚀" : "💰";
    return { title: `${emoji} Savings milestone!`, body: `${name} is ${milestone}% funded`, tag: "savings-milestone" };
  }

  return {
    title: "💰 Savings milestones hit!",
    body: hits.map((h) => `${h.name}: ${h.milestone}%`).join(", "),
    tag: "savings-milestone",
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

// ─── Birthday Reminder ────────────────────────────────────────────────────────
export async function birthdayReminderHandler(
  uid: string,
  tz: string,
  daysBefore: number
): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const todayStr = todayLocal(tz);
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  today.setHours(0, 0, 0, 0);

  const peopleSnap = await db.collection(`users/${uid}/people`).get();
  const upcoming: { name: string; daysUntil: number; giftIdeas: string[] }[] = [];

  for (const doc of peopleSnap.docs) {
    const data = doc.data();
    if (!data.birthday) continue;
    const [, month, day] = (data.birthday as string).split("-").map(Number);
    for (const yearOffset of [0, 1]) {
      const next = new Date(today.getFullYear() + yearOffset, month - 1, day);
      const diff = Math.round((next.getTime() - today.getTime()) / 86_400_000);
      if (diff >= 0 && diff <= daysBefore) {
        upcoming.push({
          name: data.name as string,
          daysUntil: diff,
          giftIdeas: (data.gift_ideas as string[] | undefined) ?? [],
        });
        break;
      }
    }
  }

  if (upcoming.length === 0) return null;

  // Deduplicate: only fire once per day per person
  const sentDoc = await db.doc(`users/${uid}/notification_sent/birthday_${todayStr}`).get();
  const alreadySent: string[] = sentDoc.exists ? (sentDoc.data()?.names as string[]) ?? [] : [];
  const newOnes = upcoming.filter((u) => !alreadySent.includes(u.name));
  if (newOnes.length === 0) return null;

  await db.doc(`users/${uid}/notification_sent/birthday_${todayStr}`).set(
    { names: [...alreadySent, ...newOnes.map((u) => u.name)] },
    { merge: true }
  );

  if (newOnes.length === 1) {
    const p = newOnes[0];
    const when = p.daysUntil === 0 ? "today" : p.daysUntil === 1 ? "tomorrow" : `in ${p.daysUntil} days`;
    const giftHint = p.giftIdeas.length > 0 ? ` Gift idea: ${p.giftIdeas[0]}` : "";
    return { title: "🎂 Birthday Reminder", body: `${p.name}'s birthday is ${when}.${giftHint}`, tag: "birthday-reminder" };
  }

  const names = newOnes.map((u) => `${u.name} (${u.daysUntil === 0 ? "today" : `${u.daysUntil}d`})`).join(", ");
  return { title: "🎂 Upcoming Birthdays", body: names, tag: "birthday-reminder" };
}

// ─── Progress Reminder (mid-day + evening) ────────────────────────────────────
// Checks actual progress against daily targets and only fires if behind.
// Used for both the midday (13:00) and evening (18:00) checks — same logic,
// same handler; the cron fires it at whichever times the user configures.
export async function progressReminderHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const today = todayLocal(tz);
  const todayDay = localNow(tz).getDay();

  const behind: string[] = [];

  // ── 1. Hydration ─────────────────────────────────────────────────────────
  try {
    const hydDoc = await db.doc(`users/${uid}/hydration/${today}`).get();
    const glasses: number = hydDoc.exists ? (hydDoc.data()?.glasses ?? 0) : 0;
    const goal: number    = hydDoc.exists ? (hydDoc.data()?.goal    ?? 8) : 8;
    // Fire if below 50% of goal
    if (glasses < goal * 0.5) {
      behind.push(`💧 ${glasses}/${goal} glasses`);
    }
  } catch { /* no hydration data — skip */ }

  // ── 2. Steps (from health log if synced) ─────────────────────────────────
  try {
    const healthDoc = await db.doc(`users/${uid}/health/${today}`).get();
    if (healthDoc.exists) {
      const data = healthDoc.data()!;
      const steps: number | undefined    = data.steps as number | undefined;
      const stepsGoal: number            = (data.steps_goal as number | undefined) ?? 10000;
      if (steps !== undefined && steps < stepsGoal * 0.5) {
        behind.push(`🚶 ${steps.toLocaleString()}/${stepsGoal.toLocaleString()} steps`);
      }
    }
  } catch { /* health doc not synced yet — skip */ }

  // ── 3. Habits due today but not yet completed ─────────────────────────────
  try {
    const habitsSnap = await db.collection(`users/${uid}/habits`).get();
    const incomplete = habitsSnap.docs.filter((d) => {
      const habit = d.data();
      const targetDays: number[] = habit.target_days ?? [0, 1, 2, 3, 4, 5, 6];
      if (!targetDays.includes(todayDay)) return false;
      const completions: string[] = habit.completions ?? [];
      return !completions.includes(today);
    });
    if (incomplete.length > 0) {
      const shown = incomplete.slice(0, 2).map((d) => d.data().name as string).join(", ");
      const extra = incomplete.length > 2 ? ` +${incomplete.length - 2}` : "";
      behind.push(`✅ ${shown}${extra}`);
    }
  } catch { /* skip */ }

  // ── 4. Nutrition — no meals logged today ─────────────────────────────────
  try {
    const nutritionSnap = await db.collection(`users/${uid}/nutrition`)
      .where("date", "==", today).limit(1).get();
    if (nutritionSnap.empty) {
      behind.push("🥗 No meals logged");
    }
  } catch { /* skip */ }

  // ── 5. Workout — scheduled training day with no session logged ────────────
  try {
    const [workoutSnap, habitsSnap] = await Promise.all([
      db.collection(`users/${uid}/workouts`).where("date", "==", today).limit(1).get(),
      db.collection(`users/${uid}/habits`).get(),
    ]);
    if (workoutSnap.empty) {
      const workoutKeywords = ["workout", "gym", "exercise", "training", "lift", "run"];
      const hasWorkoutHabitToday = habitsSnap.docs.some((d) => {
        const habit = d.data();
        const name = (habit.name as string ?? "").toLowerCase();
        const targetDays: number[] = habit.target_days ?? [0, 1, 2, 3, 4, 5, 6];
        return workoutKeywords.some((kw) => name.includes(kw)) && targetDays.includes(todayDay);
      });
      if (hasWorkoutHabitToday) {
        behind.push("💪 Workout not done");
      }
    }
  } catch { /* skip */ }

  if (behind.length === 0) return null;

  // Cap at 3 items to keep the notification readable
  const body = behind.slice(0, 3).join(" · ");
  const more = behind.length > 3 ? ` +${behind.length - 3} more` : "";
  return {
    title: "📊 Progress check-in",
    body: `${body}${more}`,
    tag: "progress-reminder",
  };
}

// ── Decision Review Notifications ─────────────────────────────────────────────
export async function decisionReviewHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const today = todayLocal(tz);

  // Dedup — only fire once per day
  const dedupRef = db.doc(`users/${uid}/notification_sent/decision_review_${today}`);
  const dedupSnap = await dedupRef.get();
  if (dedupSnap.exists) return null;

  // Find decisions whose review_date is today or overdue and still pending
  const snap = await db.collection(`users/${uid}/decisions`)
    .where("status", "==", "pending_review")
    .where("review_date", "<=", today)
    .get();

  if (snap.empty) return null;

  await dedupRef.set({ sent_at: new Date().toISOString() });

  const count = snap.size;
  const first = snap.docs[0].data().title as string;
  const body = count === 1
    ? `"${first}" is ready for review`
    : `"${first}" and ${count - 1} other${count > 2 ? "s" : ""} ready for review`;

  return {
    title: "🧠 Decision review due",
    body,
    tag: "decision-review",
  };
}

// ── Net Worth Monthly Reminder ────────────────────────────────────────────────
export async function netWorthReminderHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const now = localNow(tz);
  const today = todayLocal(tz);

  // Only fire on the 1st of the month
  if (now.getDate() !== 1) return null;

  // Dedup — only once per month
  const monthKey = today.slice(0, 7); // YYYY-MM
  const dedupRef = db.doc(`users/${uid}/notification_sent/networth_reminder_${monthKey}`);
  const dedupSnap = await dedupRef.get();
  if (dedupSnap.exists) return null;

  // Check if a snapshot was already logged this month
  const monthStart = `${monthKey}-01`;
  const snap = await db.collection(`users/${uid}/net_worth_snapshots`)
    .where("date", ">=", monthStart)
    .limit(1)
    .get();

  if (!snap.empty) return null; // already logged this month

  await dedupRef.set({ sent_at: new Date().toISOString() });

  return {
    title: "💰 Net worth check-in",
    body: "Time to log your monthly net worth snapshot",
    tag: "networth-reminder",
  };
}

// ── Subscription Renewal ──────────────────────────────────────────────────────
function cycleSuffix(cycle: BillingCycle): string {
  const map: Record<BillingCycle, string> = { weekly: '/wk', monthly: '/mo', quarterly: '/qtr', yearly: '/yr' };
  return map[cycle] ?? '';
}

function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'weekly':    return amount * 4.33;
    case 'monthly':   return amount;
    case 'quarterly': return amount / 3;
    case 'yearly':    return amount / 12;
  }
}

export async function subscriptionRenewalHandler(
  uid: string,
  daysBefore: number
): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const snap = await db.collection(`users/${uid}/subscriptions`)
    .where('status', '==', 'active')
    .get();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysBefore);
  const cutoffStr = format(cutoff, 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');

  const due = snap.docs
    .map(d => d.data() as Subscription)
    .filter(s => s.next_billing_date >= todayStr && s.next_billing_date <= cutoffStr);

  if (due.length === 0) return null;

  if (due.length === 1) {
    const s = due[0];
    const days = differenceInDays(parseISO(s.next_billing_date), today);
    return {
      title: `${s.name} renews ${days === 0 ? 'today' : `in ${days}d`}`,
      body: `$${s.amount}${cycleSuffix(s.billing_cycle)} — tap to review`,
      tag: 'subscription-renewal',
    };
  }

  const total = due.reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.billing_cycle), 0);
  return {
    title: `${due.length} subscriptions renewing soon`,
    body: `${due.map(s => s.name).join(', ')} · ~$${total.toFixed(2)}/mo`,
    tag: 'subscription-renewal',
  };
}

// ── Spending Trend Predictions ────────────────────────────────────────────────
const PLAID_TO_BUDGET: Record<string, string> = {
  FOOD_AND_DRINK:       "Food & Drink",
  GENERAL_MERCHANDISE:  "Shopping",
  ENTERTAINMENT:        "Entertainment",
  TRANSPORTATION:       "Transportation",
  RENT_AND_UTILITIES:   "Utilities",
  MEDICAL:              "Medical",
  PERSONAL_CARE:        "Personal Care",
  TRAVEL:               "Travel",
  HOME_IMPROVEMENT:     "Home",
  LOAN_PAYMENTS:        "Loan Payments",
  GENERAL_SERVICES:     "Services",
  BANK_FEES:            "Bank Fees",
};

export async function spendingTrendHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const now = localNow(tz);
  const today = todayLocal(tz);
  const currentDay = now.getDate();

  // Only fire between the 10th and 25th of the month
  if (currentDay < 10 || currentDay > 25) return null;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const paceMultiplier = daysInMonth / currentDay;
  const currentMonth = today.slice(0, 7); // YYYY-MM

  const budgetDoc = await db.doc(`users/${uid}/budgets/${currentMonth}`).get();
  if (!budgetDoc.exists) return null;
  const categories = (budgetDoc.data()?.categories ?? {}) as Record<string, { limit: number }>;
  if (Object.keys(categories).length === 0) return null;

  const monthStart = `${currentMonth}-01`;
  const monthEnd = `${currentMonth}-31`;

  const [manualSnap, plaidSnap] = await Promise.all([
    db.collection(`users/${uid}/transactions`)
      .where("date", ">=", monthStart)
      .where("date", "<=", monthEnd)
      .get(),
    db.collection(`users/${uid}/plaid_transactions`)
      .where("date", ">=", monthStart)
      .where("date", "<=", monthEnd)
      .get(),
  ]);

  const actuals: Record<string, number> = {};
  for (const d of manualSnap.docs) {
    const tx = d.data();
    if (tx.type !== "expense") continue;
    const cat = tx.category as string;
    actuals[cat] = (actuals[cat] ?? 0) + (tx.amount as number);
  }
  for (const d of plaidSnap.docs) {
    const tx = d.data();
    if ((tx.amount as number) <= 0) continue;
    const cat = PLAID_TO_BUDGET[tx.category as string] ?? (tx.category as string);
    actuals[cat] = (actuals[cat] ?? 0) + (tx.amount as number);
  }

  const atRisk: { category: string; overage: number }[] = [];
  for (const [cat, { limit }] of Object.entries(categories)) {
    if (limit <= 0) continue;
    const actual = actuals[cat] ?? 0;
    if (actual < limit * 0.4) continue; // avoid false alarms early in month
    const projected = actual * paceMultiplier;
    if (projected <= limit) continue;
    atRisk.push({ category: cat, overage: Math.round(projected - limit) });
  }

  if (atRisk.length === 0) return null;

  // Deduplicate — only fire once per category per day
  const dedupRef = db.doc(`users/${uid}/notification_sent/spending_trend_${today}`);
  const dedupSnap = await dedupRef.get();
  const alreadySent: string[] = dedupSnap.exists ? (dedupSnap.data()?.categories as string[]) ?? [] : [];
  const newRisks = atRisk.filter((r) => !alreadySent.includes(r.category));
  if (newRisks.length === 0) return null;

  await dedupRef.set(
    { categories: [...alreadySent, ...newRisks.map((r) => r.category)] },
    { merge: true }
  );

  if (newRisks.length === 1) {
    const { category, overage } = newRisks[0];
    return {
      title: "📈 Spending pace alert",
      body: `You're on pace to overspend ${category} by $${overage} this month`,
      tag: "spending-trend",
    };
  }

  const summary = newRisks.slice(0, 3).map((r) => `${r.category} (+$${r.overage})`).join(", ");
  const more = newRisks.length > 3 ? ` +${newRisks.length - 3} more` : "";
  return {
    title: "📈 Budget pace alert",
    body: `On pace to overspend: ${summary}${more}`,
    tag: "spending-trend",
  };
}

// ── Season Check-In Nudge ────────────────────────────────────────────────────
export async function seasonCheckinHandler(uid: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const seasonDoc = await db.doc(`users/${uid}/season/current`).get();
  if (!seasonDoc.exists) return null;

  const season = seasonDoc.data()!;
  if (!season.checkin_complete) return null;

  const weeks = Math.floor(
    (Date.now() - new Date(season.started_at as string).getTime()) / (1000 * 60 * 60 * 24 * 7)
  );
  if (weeks < 4) return null;

  // Dedup: only fire once per 7-day window
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dedupSnap = await db.collection(`users/${uid}/notifications`)
    .where("type", "==", "season_checkin")
    .where("sent_at", ">=", cutoff)
    .limit(1)
    .get();
  if (!dedupSnap.empty) return null;

  await db.collection(`users/${uid}/notifications`).add({
    type: "season_checkin",
    sent_at: new Date().toISOString(),
  });

  return {
    title: "Season Check-In",
    body: `You've been in "${season.name as string}" for ${weeks} weeks. Worth a moment to reflect — is this season still accurate?`,
    tag: "season-checkin",
  };
}

// ── End-of-Day Time Summary ───────────────────────────────────────────────────
export async function timeSummaryHandler(uid: string, tz: string): Promise<NotifPayload | null> {
  const db = getAdminDb();
  const today = todayLocal(tz);

  // Dedup — only once per day
  const dedupRef = db.doc(`users/${uid}/notification_sent/time_summary_${today}`);
  const dedupSnap = await dedupRef.get();
  if (dedupSnap.exists) return null;

  // Fetch today's time entries
  const snap = await db.collection(`users/${uid}/time_entries`)
    .where("date", "==", today)
    .get();

  if (snap.empty) return null; // nothing tracked today, skip

  // Tally total minutes and top categories
  let totalMins = 0;
  const catMins: Record<string, number> = {};
  for (const d of snap.docs) {
    const entry = d.data();
    const mins = (entry.duration_minutes as number) ?? 0;
    totalMins += mins;
    const cat = (entry.category as string) || "Other";
    catMins[cat] = (catMins[cat] ?? 0) + mins;
  }

  if (totalMins < 10) return null; // less than 10 minutes — not worth notifying

  await dedupRef.set({ sent_at: new Date().toISOString() });

  const totalHrs = (totalMins / 60).toFixed(1);
  const top = Object.entries(catMins)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([cat, mins]) => `${cat} ${(mins / 60).toFixed(1)}h`)
    .join(", ");

  return {
    title: `⏱ ${totalHrs}h tracked today`,
    body: top || `${snap.size} session${snap.size > 1 ? "s" : ""} logged`,
    tag: "time-summary",
  };
}

// buildContextSnapshot(uid) — a lean, real-time "state snapshot" injected into the
// system prompt of every chat AND voice session so the agent opens already oriented
// (today's calendar, top tasks, habit status, hydration, budget reds, people due, weather).
//
// Design constraint: this ships on EVERY turn — and for voice it adds to an already-tight
// latency budget (see memory: voice-agent-latency-rootcause). Keep lines terse: short
// signal lines, not full records. Every section is best-effort; a failing query is omitted
// rather than throwing, so a single broken integration never blocks the snapshot.

import { getAdminDb } from "@/lib/firebase-admin";
import { getDay, format, differenceInCalendarDays } from "date-fns";
import { fetchWeatherData } from "@/lib/weather";

// RFC 3339 start/end-of-day in the user's tz (mirrors daily-briefing/route.ts:localDayBounds)
function localDayBounds(date: string, tz: string): { start: string; end: string } {
  const ref = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(ref);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const offset = tzName.replace("GMT", "") || "+00:00";
  return { start: `${date}T00:00:00${offset}`, end: `${date}T23:59:59${offset}` };
}

const FREQ_DAYS: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365 };

/**
 * Build a single markdown "## Today's Snapshot" block for the given user, or null if nothing
 * useful could be gathered. `today` is the user's local date (YYYY-MM-DD) and `tz` their IANA
 * timezone — callers that have a request timezone should pass it; both default to UTC/today.
 */
export async function buildContextSnapshot(
  uid: string,
  today: string = new Date().toISOString().slice(0, 10),
  tz: string = "UTC",
): Promise<string | null> {
  const db = getAdminDb();
  const todayDow = getDay(new Date(today + "T12:00:00")); // 0=Sun
  const month = today.slice(0, 7);

  const [season, calendar, tasks, habits, hydration, budget, people, activeSOP, weather] = await Promise.all([
    // Current season name
    db.doc(`users/${uid}/season/current`).get()
      .then((s) => {
        const d = s.data();
        return s.exists && d?.checkin_complete && d?.status !== "closed" ? (d.name as string) : null;
      })
      .catch(() => null),

    // Today's calendar events
    getTodaysCalendar(uid, today, tz).catch(() => [] as string[]),

    // Top 3 priority tasks due/overdue or unscheduled
    db.collection(`users/${uid}/tasks`).where("status", "==", "active")
      .orderBy("priority_score", "desc").limit(3).get()
      .then((s) => s.docs.map((d) => {
        const t = d.data();
        return `${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`;
      }))
      .catch(() => [] as string[]),

    // Habits due today vs done
    db.collection(`users/${uid}/habits`).get()
      .then((s) => {
        const all = s.docs.map((d) => d.data());
        const due = all.filter((h) => (h.target_days ?? [0, 1, 2, 3, 4, 5, 6]).includes(todayDow));
        const done = due.filter((h) => (h.completions as string[] ?? []).includes(today)).length;
        return { due: due.length, done };
      })
      .catch(() => ({ due: 0, done: 0 })),

    // Hydration today
    db.doc(`users/${uid}/hydration/${today}`).get()
      .then((s) => {
        if (!s.exists) return null;
        const d = s.data()!;
        return { glasses: (d.glasses as number) ?? 0, goal: (d.goal as number) ?? 8 };
      })
      .catch(() => null),

    // Budget categories in the red this month
    getBudgetReds(uid, month).catch(() => [] as string[]),

    // People: birthdays next 7 days + overdue contacts
    getPeopleSignals(uid, today).catch(() => ({ birthdays: [] as string[], overdue: [] as string[] })),

    // Active SOP
    db.doc(`users/${uid}/settings/active_sop`).get()
      .then((s) => {
        if (!s.exists || !s.data()?.sopId) return null;
        const d = s.data()!;
        return { title: d.sopTitle as string, step: (d.stepIndex as number) + 1, total: d.totalSteps as number };
      })
      .catch(() => null),

    // Weather
    db.doc(`users/${uid}/settings/weather`).get()
      .then(async (s) => {
        if (!s.exists) return null;
        const w = s.data()!;
        const wd = await fetchWeatherData(w.latitude, w.longitude, w.units ?? "fahrenheit", w.city ?? "");
        const deg = wd.units === "celsius" ? "°C" : "°F";
        return `${wd.current.condition}, ${wd.current.temp}${deg} (high ${wd.daily[0].temp_max}${deg}, low ${wd.daily[0].temp_min}${deg})`;
      })
      .catch(() => null),
  ]);

  const lines: string[] = [];
  lines.push(`Date: ${format(new Date(today + "T12:00:00"), "EEEE, MMMM d, yyyy")}${season ? ` · Season: ${season}` : ""}`);

  if (calendar.length) lines.push(`Calendar: ${calendar.join("; ")}`);
  else lines.push("Calendar: nothing scheduled");

  if (tasks.length) lines.push(`Top tasks: ${tasks.join("; ")}`);

  if (habits.due > 0) lines.push(`Habits: ${habits.done}/${habits.due} done today`);

  if (hydration) lines.push(`Hydration: ${hydration.glasses}/${hydration.goal} glasses`);

  if (budget.length) lines.push(`Budget over/near limit: ${budget.join("; ")}`);

  if (people.birthdays.length) lines.push(`Birthdays soon: ${people.birthdays.join("; ")}`);
  if (people.overdue.length) lines.push(`Overdue to contact: ${people.overdue.join("; ")}`);

  if (weather) lines.push(`Weather: ${weather}`);

  if (activeSOP) lines.push(`Active SOP: ${activeSOP.title} — step ${activeSOP.step}/${activeSOP.total}`);

  // Only a date line means nothing useful was found.
  if (lines.length <= 1) return null;

  return `## Today's Snapshot\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getTodaysCalendar(uid: string, today: string, tz: string): Promise<string[]> {
  const db = getAdminDb();
  const tokenDoc = await db.doc(`users/${uid}/integrations/google_calendar`).get();
  if (!tokenDoc.exists) return [];
  const td = tokenDoc.data()!;
  let accessToken: string = td.access_token;
  if (Date.now() > td.expires_at - 60000) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
        refresh_token: td.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    if (data.error) return [];
    accessToken = data.access_token;
    await tokenDoc.ref.update({ access_token: accessToken, expires_at: Date.now() + 3600 * 1000 });
  }
  const { start, end } = localDayBounds(today, tz);
  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=6`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const calData = await calRes.json();
  return (calData.items ?? []).map((e: Record<string, unknown>) => {
    const startObj = e.start as Record<string, string> | undefined;
    const title = (e.summary as string) ?? "Untitled";
    if (!startObj?.dateTime) return `${title} (all day)`;
    return `${title} at ${startObj.dateTime.slice(11, 16)}`;
  });
}

export async function getBudgetReds(uid: string, month: string): Promise<string[]> {
  const db = getAdminDb();
  const [budgetSnap, txSnap] = await Promise.all([
    db.doc(`users/${uid}/budgets/${month}`).get(),
    db.collection(`users/${uid}/transactions`).where("date", ">=", `${month}-01`).where("date", "<=", `${month}-31`).get(),
  ]);
  if (!budgetSnap.exists) return [];
  const categories: Record<string, { limit: number; alert_threshold: number }> = budgetSnap.data()?.categories ?? {};
  const actuals: Record<string, number> = {};
  for (const d of txSnap.docs) {
    const t = d.data();
    if (t.type === "expense") actuals[t.category] = (actuals[t.category] ?? 0) + (t.amount as number);
  }
  const reds: string[] = [];
  for (const [cat, entry] of Object.entries(categories)) {
    const spent = actuals[cat] ?? 0;
    const pct = entry.limit > 0 ? spent / entry.limit : 0;
    if (spent > entry.limit) reds.push(`${cat} OVER ($${spent.toFixed(0)}/$${entry.limit.toFixed(0)})`);
    else if (pct >= (entry.alert_threshold ?? 0.8)) reds.push(`${cat} near (${Math.round(pct * 100)}%)`);
  }
  return reds;
}

export async function getPeopleSignals(uid: string, today: string): Promise<{ birthdays: string[]; overdue: string[] }> {
  const db = getAdminDb();
  const snap = await db.collection(`users/${uid}/people`).get();
  const ref = new Date(today + "T12:00:00");
  const birthdays: string[] = [];
  const overdue: string[] = [];
  for (const d of snap.docs) {
    const p = d.data();
    // Birthday within next 7 days (compare month-day against this year, roll to next year if passed)
    if (typeof p.birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.birthday)) {
      const md = p.birthday.slice(5);
      let delta = differenceInCalendarDays(new Date(`${ref.getFullYear()}-${md}T12:00:00`), ref);
      if (delta < 0) delta = differenceInCalendarDays(new Date(`${ref.getFullYear() + 1}-${md}T12:00:00`), ref);
      if (delta >= 0 && delta <= 7) birthdays.push(`${p.name}${delta === 0 ? " (today!)" : ` in ${delta}d`}`);
    }
    // Overdue to contact (mirror hooks/usePeople.ts isOverdue)
    if (p.contact_frequency && typeof p.last_contacted === "string") {
      const days = differenceInCalendarDays(ref, new Date(p.last_contacted + "T12:00:00"));
      const threshold = FREQ_DAYS[p.contact_frequency as string];
      if (threshold && days > threshold) overdue.push(`${p.name} (${days}d)`);
    }
  }
  return { birthdays: birthdays.slice(0, 5), overdue: overdue.slice(0, 5) };
}

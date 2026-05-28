// POST /api/daily-briefing — generate + persist today's morning briefing for one user (ID token auth)
// GET  /api/daily-briefing — cron trigger (CRON_SECRET auth) — runs for all users
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, CRON_SECRET } from "@/lib/env";
import { format, getDay } from "date-fns";
import { getLocalTimeInfo } from "@/lib/timezone";
import { fetchWeatherData } from "@/lib/weather";
import { getConstitutionContext } from "@/lib/constitution";
import { getWhatMattersForContext } from "@/lib/what-matters";

// Returns RFC 3339 start/end-of-day strings in the user's local timezone so the
// Google Calendar query covers exactly the user's local day, not UTC midnight→midnight.
function localDayBounds(date: string, tz: string): { start: string; end: string } {
  // Use noon UTC as a safe reference point away from DST transition boundaries.
  const ref = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  }).formatToParts(ref);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const offset = tzName.replace("GMT", "") || "+00:00"; // e.g. "-04:00" or "+05:30"
  return {
    start: `${date}T00:00:00${offset}`,
    end:   `${date}T23:59:59${offset}`,
  };
}

function isCronAuthed(req: NextRequest): boolean {
  return (req.headers.get("Authorization") ?? "") === `Bearer ${CRON_SECRET}`;
}

async function getUidFromToken(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    if (token === CRON_SECRET) return null;
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

async function collectContext(uid: string, today: string, tz: string) {
  const db = getAdminDb();
  const todayDow = getDay(new Date(today + "T12:00:00")); // 0=Sun

  // Top active tasks (by priority)
  const tasksSnap = await db.collection(`users/${uid}/tasks`)
    .where("status", "==", "active")
    .orderBy("priority_score", "desc")
    .limit(8)
    .get();
  const tasks = tasksSnap.docs.map((d) => d.data());

  // Habits due today
  const habitsSnap = await db.collection(`users/${uid}/habits`).get();
  const habits = habitsSnap.docs.map((d) => d.data());
  const habitsDue = habits.filter((h) => {
    const targetDays: number[] = h.target_days ?? [0, 1, 2, 3, 4, 5, 6];
    return targetDays.includes(todayDow);
  });
  const habitsDoneToday = habitsDue.filter((h) => (h.completions as string[] ?? []).includes(today));

  // Today's calendar events (if calendar connected)
  let calendarEvents: { title: string; start: string; allDay: boolean }[] = [];
  try {
    const tokenDoc = await db.doc(`users/${uid}/integrations/google_calendar`).get();
    if (tokenDoc.exists) {
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
        if (!data.error) {
          accessToken = data.access_token;
          await tokenDoc.ref.update({ access_token: accessToken, expires_at: Date.now() + 3600 * 1000 });
        }
      }
      const { start: startOfDay, end: endOfDay } = localDayBounds(today, tz);
      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startOfDay}&timeMax=${endOfDay}&singleEvents=true&orderBy=startTime&maxResults=10`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const calData = await calRes.json();
      calendarEvents = (calData.items ?? []).map((e: Record<string, unknown>) => ({
        title: e.summary as string ?? "Untitled",
        start: ((e.start as Record<string, string>)?.dateTime ?? (e.start as Record<string, string>)?.date ?? "") as string,
        allDay: !(e.start as Record<string, string>)?.dateTime,
      }));
    }
  } catch {
    // Calendar optional — continue without it
  }

  // Recent health log
  const healthSnap = await db.collection(`users/${uid}/health`)
    .orderBy("date", "desc").limit(1).get();
  const latestHealth = healthSnap.docs[0]?.data() ?? null;

  // Active goals
  const goalsSnap = await db.collection(`users/${uid}/goals`)
    .where("status", "==", "active").limit(5).get();
  const goals = goalsSnap.docs.map((d) => d.data());

  // Memory
  const memSnap = await db.collection(`users/${uid}/memory`).get();
  const memoryLines = memSnap.docs.map((d) => {
    const data = d.data();
    return `${data.key}: ${data.value}`;
  });

  // Weather (optional — skip gracefully if not configured)
  let weatherLine: string | null = null;
  try {
    const weatherSnap = await db.doc(`users/${uid}/settings/weather`).get();
    if (weatherSnap.exists) {
      const w = weatherSnap.data()!;
      const wd = await fetchWeatherData(w.latitude, w.longitude, w.units ?? "fahrenheit", w.city ?? "");
      const deg = wd.units === "celsius" ? "°C" : "°F";
      weatherLine = `${wd.current.condition}, ${wd.current.temp}${deg} (feels ${wd.current.feels_like}${deg}). Today: High ${wd.daily[0].temp_max}${deg}, Low ${wd.daily[0].temp_min}${deg}.`;
    }
  } catch {
    // Weather is optional — continue without it
  }

  // Constitution (optional — inject into system prompt if present)
  const constitutionCtx = await getConstitutionContext(uid).catch(() => null);

  // "What Actually Matters" signal (optional — prepend to briefing if available)
  const whatMattersCtx = await getWhatMattersForContext(uid).catch(() => null);

  return { tasks, habitsDue, habitsDoneToday, calendarEvents, latestHealth, goals, memoryLines, weatherLine, constitutionCtx, whatMattersCtx };
}

async function generateBriefing(uid: string, today: string, tz: string): Promise<{
  content: string;
  calendar_events: number;
  tasks_flagged: number;
  habits_due: number;
}> {
  const ctx = await collectContext(uid, today, tz);
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const taskLines = ctx.tasks.length
    ? ctx.tasks.map((t, i) => `${i + 1}. ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`).join("\n")
    : "No active tasks";

  const habitLines = ctx.habitsDue.length
    ? ctx.habitsDue.map((h) => `- ${h.name}: ${ctx.habitsDoneToday.find((d) => d.name === h.name) ? "✓ done" : "pending"}`).join("\n")
    : "No habits due today";

  const calLines = ctx.calendarEvents.length
    ? ctx.calendarEvents.map((e) => `- ${e.title}${e.allDay ? " (all day)" : ` at ${e.start.slice(11, 16)}`}`).join("\n")
    : "No calendar events today";

  const healthLine = ctx.latestHealth
    ? `${ctx.latestHealth.date === today ? "Today" : `Last logged ${ctx.latestHealth.date}`}: Sleep ${ctx.latestHealth.sleep_hours}h, Energy ${ctx.latestHealth.energy_level}/10${ctx.latestHealth.exercise_done ? ", exercised" : ""}`
    : "No recent health log";

  const goalLines = ctx.goals.length
    ? ctx.goals.map((g) => {
        const done = (g.milestones as { completed: boolean }[] ?? []).filter((m) => m.completed).length;
        const total = (g.milestones as { completed: boolean }[] ?? []).length;
        return `- ${g.title}${total > 0 ? ` (${done}/${total} milestones)` : ""}`;
      }).join("\n")
    : "No active goals";

  const memoryCtx = ctx.memoryLines.length
    ? `User context:\n${ctx.memoryLines.slice(0, 20).join("\n")}`
    : "";
  const systemPrompt = [
    "You are a personal productivity assistant.",
    memoryCtx,
    ctx.constitutionCtx ?? "",
  ].filter(Boolean).join("\n\n");

  const userPrompt = `Today is ${today} (${format(new Date(today + "T12:00:00"), "EEEE, MMMM d, yyyy")}).
${ctx.whatMattersCtx ? `\n${ctx.whatMattersCtx}\n` : ""}
Generate a concise, motivating morning briefing. Include:
1. A short personalized greeting (1 sentence)
2. **Today's priorities** — top 3 tasks with brief reasoning
3. **Habits** — which are due and any already done
4. **Calendar** — key events for today
5. **Goals check-in** — brief note on active goals
6. One actionable insight or suggestion

Keep it under 250 words. Be direct and energizing. Use markdown headers.

---
TASKS:
${taskLines}

HABITS TODAY:
${habitLines}

CALENDAR:
${calLines}

HEALTH:
${healthLine}

WEATHER:
${ctx.weatherLine ?? "Not configured"}

ACTIVE GOALS:
${goalLines}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = msg.content[0].type === "text" ? msg.content[0].text : "";

  // Persist to Firestore
  const db = getAdminDb();
  await db.doc(`users/${uid}/daily_briefings/${today}`).set({
    date: today,
    content,
    generated_at: new Date().toISOString(),
    calendar_events: ctx.calendarEvents.length,
    tasks_flagged: Math.min(ctx.tasks.length, 3),
    habits_due: ctx.habitsDue.length,
  });

  return {
    content,
    calendar_events: ctx.calendarEvents.length,
    tasks_flagged: Math.min(ctx.tasks.length, 3),
    habits_due: ctx.habitsDue.length,
  };
}

// ─── POST — single user manual trigger ────────────────────────────────────────

export async function POST(req: NextRequest) {
  const uid = await getUidFromToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Use the timezone from the request header (set by the client) so "today" matches the user's local date
  const clientTz = req.headers.get("X-Timezone") ?? "UTC";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: clientTz });

  try {
    const result = await generateBriefing(uid, today, clientTz);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Daily briefing error:", err);
    return NextResponse.json({ error: "Failed to generate briefing" }, { status: 500 });
  }
}

// ─── GET — cron trigger for all users ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminDb();
  const usersSnap = await db.collection("users").get();
  const results: Record<string, string> = {};

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    try {
      const timeInfo = await getLocalTimeInfo(uid);
      const today = timeInfo.localDate;
      const tz = timeInfo.tz;

      // Only generate during the 5–9 AM window in the user's local timezone.
      // Without this guard the first hourly fire after midnight UTC (8 PM Eastern)
      // would build "today's" briefing the night before.
      if (timeInfo.localHour < 5 || timeInfo.localHour >= 9) {
        results[uid] = `skipped (outside generation window — local hour ${timeInfo.localHour})`;
        continue;
      }

      // Skip if briefing already generated for today in user's local timezone
      const existing = await db.doc(`users/${uid}/daily_briefings/${today}`).get();
      if (existing.exists) {
        results[uid] = `skipped (already generated for ${today})`;
        continue;
      }

      await generateBriefing(uid, today, tz);
      results[uid] = `ok (${today})`;
    } catch (err) {
      results[uid] = `error: ${err}`;
    }
  }

  return NextResponse.json({ results });
}

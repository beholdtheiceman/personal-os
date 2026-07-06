// GET  /api/meeting-prep — hourly cron: generate briefings for imminent events, prompt post-meeting capture
// POST /api/meeting-prep — manual trigger for a single user (Firebase ID token auth)
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, CRON_SECRET } from "@/lib/env";
import { sendPushToUser } from "@/lib/send-push";
import { mergeNotificationSettings } from "@/types";

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

function isCronAuthed(req: NextRequest): boolean {
  return CRON_SECRET !== "" && (req.headers.get("Authorization") ?? "") === `Bearer ${CRON_SECRET}`;
}
async function getUidFromToken(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ") || auth === `Bearer ${CRON_SECRET}`) return null;
    const decoded = await getAdminAuth().verifyIdToken(auth.slice(7));
    return decoded.uid;
  } catch { return null; }
}

async function getCalendarToken(uid: string): Promise<string | null> {
  const db = getAdminDb();
  const tokenDoc = await db.doc(`users/${uid}/integrations/google_calendar`).get();
  if (!tokenDoc.exists) return null;
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
  return accessToken;
}

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendeeEmails: string[];
}

async function getImminentEvents(accessToken: string): Promise<CalEvent[]> {
  const now = new Date();
  const twoHoursOut = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${now.toISOString()}&timeMax=${twoHoursOut.toISOString()}` +
    `&singleEvents=true&orderBy=startTime&maxResults=20`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? [])
    .filter((e: Record<string, unknown>) => (e.start as Record<string, string>)?.dateTime)
    .map((e: Record<string, unknown>) => ({
      id: e.id as string,
      title: (e.summary as string) ?? "Untitled",
      start: (e.start as Record<string, string>).dateTime,
      end: (e.end as Record<string, string>).dateTime,
      attendeeEmails: ((e.attendees as { email: string }[]) ?? []).map((a) => a.email),
    }));
}

async function buildBriefing(uid: string, event: CalEvent): Promise<string> {
  const db = getAdminDb();

  // People CRM: match attendees by email or name fragment
  const peopleSnap = await db.collection(`users/${uid}/people`).get();
  const people = peopleSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>);
  const attendeeContext = event.attendeeEmails
    .filter((email) => !email.includes("calendar.google.com"))
    .map((email) => {
      const match = people.find(
        (p) =>
          (p.email as string)?.toLowerCase() === email.toLowerCase() ||
          (p.name as string)?.toLowerCase().includes(email.split("@")[0].toLowerCase()),
      );
      if (!match) return `- ${email} (not in CRM)`;
      const last = match.last_contacted ? `last contact: ${match.last_contacted}` : "no recent contact logged";
      const notes = match.notes ? ` | notes: ${String(match.notes).slice(0, 120)}` : "";
      return `- **${match.name}** (${email}) — ${match.relationship ?? "contact"}, ${last}${notes}`;
    })
    .join("\n");

  // Related open tasks (keyword match on event title words)
  const tasksSnap = await db.collection(`users/${uid}/tasks`)
    .where("status", "==", "active").orderBy("priority_score", "desc").limit(10).get();
  const eventWords = event.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const relatedTasks = tasksSnap.docs
    .map((d) => d.data())
    .filter((t) => eventWords.some((w) => String(t.title ?? "").toLowerCase().includes(w)))
    .slice(0, 5)
    .map((t) => `- ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`);

  // Related decisions
  const decisionsSnap = await db.collection(`users/${uid}/decisions`)
    .orderBy("created_at", "desc").limit(20).get();
  const relatedDecisions = decisionsSnap.docs
    .map((d) => d.data())
    .filter((dec) => eventWords.some((w) => String(dec.title ?? "").toLowerCase().includes(w)))
    .slice(0, 3)
    .map((dec) => `- ${dec.title} (${dec.chosen_option})`);

  const startLocal = new Date(event.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const sections = [
    `Meeting: "${event.title}" at ${startLocal}`,
    `Attendees:\n${attendeeContext || "No CRM matches found"}`,
    relatedTasks.length ? `Related tasks:\n${relatedTasks.join("\n")}` : "",
    relatedDecisions.length ? `Related decisions:\n${relatedDecisions.join("\n")}` : "",
  ].filter(Boolean).join("\n\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `You are a personal assistant. Write a concise pre-meeting briefing (3-5 bullets) covering: who's attending and relevant context, any open tasks or decisions relevant to this meeting, and 1-2 suggested talking points. Be brief — read in under 60 seconds. Use markdown bullets.\n\n${sections}`,
    }],
  });
  return (msg.content[0] as { text: string }).text;
}

async function processUser(uid: string): Promise<string[]> {
  const db = getAdminDb();
  const fired: string[] = [];

  const settingsSnap = await db.doc(`users/${uid}/settings/notifications`).get();
  const settings = mergeNotificationSettings(settingsSnap.data() as Record<string, unknown> | undefined);
  if (!settings.meeting_prep?.enabled) return fired;

  const accessToken = await getCalendarToken(uid);
  if (!accessToken) return fired;

  const events = await getImminentEvents(accessToken);
  const now = Date.now();

  for (const event of events) {
    const startMs = new Date(event.start).getTime();
    const minutesUntil = (startMs - now) / 60000;

    // Pre-meeting: generate briefing 10-35 min before start
    if (minutesUntil >= 10 && minutesUntil <= 35) {
      const dedupKey = `meeting_prep_${event.id}`;
      const alreadySent = (await db.doc(`users/${uid}/notification_sent/${dedupKey}`).get()).exists;
      if (!alreadySent) {
        try {
          const content = await buildBriefing(uid, event);
          const startLocal = new Date(event.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          await db.doc(`users/${uid}/meeting_preps/${event.id}`).set({
            eventId: event.id,
            eventTitle: event.title,
            eventStart: event.start,
            eventEnd: event.end,
            content,
            generated_at: new Date().toISOString(),
            post_meeting_prompted: false,
          });
          await sendPushToUser(uid, {
            title: `📋 Meeting in ~${Math.round(minutesUntil)} min: ${event.title}`,
            body: "Briefing ready — tap to review.",
            tag: dedupKey,
          });
          await db.doc(`users/${uid}/notification_sent/${dedupKey}`).set({ sent_at: new Date().toISOString() });
          fired.push(`prep: ${event.title} at ${startLocal}`);
        } catch {
          // Per-event failure is non-fatal
        }
      }
    }

    // Post-meeting: capture prompt 10-40 min after end
    const endMs = new Date(event.end).getTime();
    const minutesSinceEnd = (now - endMs) / 60000;
    if (minutesSinceEnd >= 10 && minutesSinceEnd <= 40) {
      const prepDoc = await db.doc(`users/${uid}/meeting_preps/${event.id}`).get();
      if (prepDoc.exists && !prepDoc.data()?.post_meeting_prompted) {
        await sendPushToUser(uid, {
          title: `How did "${event.title}" go?`,
          body: "Tap to capture notes, action items, or decisions.",
          tag: `post_meeting_${event.id}`,
        });
        await prepDoc.ref.update({ post_meeting_prompted: true });
        fired.push(`post-meeting: ${event.title}`);
      }
    }
  }

  return fired;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminDb();
  const usersSnap = await db.collection("users").get();
  const results: Record<string, string[]> = {};
  await Promise.all(
    usersSnap.docs.map(async (userDoc) => {
      try {
        const fired = await processUser(userDoc.id);
        if (fired.length) results[userDoc.id] = fired;
      } catch { /* per-user failure non-fatal */ }
    }),
  );
  return NextResponse.json({ ok: true, results });
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const fired = await processUser(uid);
    return NextResponse.json({ ok: true, fired });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

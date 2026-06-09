// POST /api/time/calendar-import — Calendar → Time Entries (PA-3b)
// Two modes:
//   { date, tz? }                  → returns { drafts: [...] } proposed time entries from
//                                     that day's calendar events. Nothing is written.
//   { commit: TimeEntryDraft[] }   → writes the confirmed drafts to users/{uid}/time_entries
//                                     with source "calendar". Returns { written }.
// This keeps the "propose, then one-tap confirm" flow: the UI shows drafts, the user picks
// which to keep, and only confirmed entries are persisted.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

interface TimeEntryDraft {
  description: string;
  start_time: string; // ISO
  end_time: string;   // ISO
  duration_min: number;
  category: string;
}

function localDayBounds(date: string, tz: string): { start: string; end: string } {
  const ref = new Date(`${date}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(ref);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const offset = tzName.replace("GMT", "") || "+00:00";
  return { start: `${date}T00:00:00${offset}`, end: `${date}T23:59:59${offset}` };
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const db = getAdminDb();

  // ── Commit mode ──
  if (Array.isArray(body.commit)) {
    const drafts = body.commit as TimeEntryDraft[];
    const now = new Date().toISOString();
    await Promise.all(
      drafts.map((d) =>
        db.collection(`users/${uid}/time_entries`).add({
          date: d.start_time.slice(0, 10),
          start_time: d.start_time,
          end_time: d.end_time,
          duration_min: d.duration_min,
          description: d.description,
          task_id: null,
          project_id: null,
          category: d.category || "work",
          source: "calendar",
          created_at: now,
        }),
      ),
    );
    return NextResponse.json({ written: drafts.length });
  }

  // ── Propose mode ──
  const date: string = typeof body.date === "string" ? body.date : new Date().toISOString().slice(0, 10);
  const tz: string = typeof body.tz === "string" ? body.tz : "UTC";

  const tokenDoc = await db.doc(`users/${uid}/integrations/google_calendar`).get();
  if (!tokenDoc.exists) return NextResponse.json({ drafts: [], reason: "calendar_not_connected" });

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
    if (data.error) return NextResponse.json({ drafts: [], reason: "token_refresh_failed" });
    accessToken = data.access_token;
    await tokenDoc.ref.update({ access_token: accessToken, expires_at: Date.now() + 3600 * 1000 });
  }

  const { start, end } = localDayBounds(date, tz);
  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const calData = await calRes.json();

  const drafts: TimeEntryDraft[] = (calData.items ?? [])
    .map((e: Record<string, unknown>): TimeEntryDraft | null => {
      const startObj = e.start as Record<string, string> | undefined;
      const endObj = e.end as Record<string, string> | undefined;
      // Only timed events (skip all-day) become time entries.
      if (!startObj?.dateTime || !endObj?.dateTime) return null;
      const startMs = new Date(startObj.dateTime).getTime();
      const endMs = new Date(endObj.dateTime).getTime();
      const duration_min = Math.max(1, Math.round((endMs - startMs) / 60000));
      // Skip events the user declined.
      const attendees = (e.attendees as Array<{ self?: boolean; responseStatus?: string }> | undefined) ?? [];
      if (attendees.some((a) => a.self && a.responseStatus === "declined")) return null;
      return {
        description: (e.summary as string) ?? "Untitled event",
        start_time: startObj.dateTime,
        end_time: endObj.dateTime,
        duration_min,
        category: "work",
      };
    })
    .filter((d: TimeEntryDraft | null): d is TimeEntryDraft => d !== null);

  return NextResponse.json({ drafts });
}

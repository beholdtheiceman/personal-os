// GET /api/calendar/events?uid=... — fetches calendar events for the next 7 days
import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ADMIN_CONFIGURED =
  !!process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
  !!process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
  process.env.FIREBASE_ADMIN_PRIVATE_KEY !== '""';

function getAdminDb() {
  if (!ADMIN_CONFIGURED) throw new Error("Firebase Admin not configured");
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description);
  return data.access_token;
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  // Return gracefully if admin SDK isn't configured yet
  if (!ADMIN_CONFIGURED) {
    return NextResponse.json({ connected: false, events: [], reason: "admin_not_configured" });
  }

  try {
    const db = getAdminDb();
    const tokenDoc = await db.doc(`users/${uid}/integrations/google_calendar`).get();

    if (!tokenDoc.exists) {
      return NextResponse.json({ connected: false, events: [] });
    }

    const tokenData = tokenDoc.data()!;
    let accessToken: string = tokenData.access_token;

    // Refresh if expired (with 60s buffer)
    if (Date.now() > tokenData.expires_at - 60000) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
      await tokenDoc.ref.update({
        access_token: accessToken,
        expires_at: Date.now() + 3600 * 1000,
      });
    }

    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Fetch list of all calendars the user has
    const calListRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: authHeader }
    );
    const calList = await calListRes.json();
    const calendarIds: string[] = (calList.items ?? [])
      .filter((c: Record<string, unknown>) => c.selected !== false)
      .map((c: Record<string, unknown>) => c.id as string);

    // Fetch events from all calendars in parallel
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: weekLater.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "50",
    });

    const allEventArrays = await Promise.all(
      calendarIds.map((calId) =>
        fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`,
          { headers: authHeader }
        ).then((r) => r.json()).then((d) => d.items ?? []).catch(() => [])
      )
    );

    // Merge, deduplicate by id, and sort by start time
    const seen = new Set<string>();
    const events = allEventArrays
      .flat()
      .filter((e: Record<string, unknown>) => {
        if (seen.has(e.id as string)) return false;
        seen.add(e.id as string);
        return true;
      })
      .map((e: Record<string, unknown>) => ({
        id: e.id,
        title: e.summary,
        start: (e.start as Record<string, string>)?.dateTime || (e.start as Record<string, string>)?.date,
        end: (e.end as Record<string, string>)?.dateTime || (e.end as Record<string, string>)?.date,
        location: e.location,
        allDay: !(e.start as Record<string, string>)?.dateTime,
      }))
      .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));

    return NextResponse.json({ connected: true, events });
  } catch (err) {
    console.error("Calendar events error:", err);
    return NextResponse.json({ connected: false, events: [], error: "Failed to fetch events" });
  }
}

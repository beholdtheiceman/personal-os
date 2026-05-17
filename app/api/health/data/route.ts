// GET /api/health/data?uid=... — fetches sleep and activity from Google Health API
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
  if (data.error) throw new Error(data.error_description ?? data.error);
  return data.access_token;
}

const BASE = "https://health.googleapis.com/v4/users/-";

async function fetchDataPoints(
  dataType: string,
  params: URLSearchParams,
  token: string
): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${BASE}/dataTypes/${dataType}/dataPoints?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.dataPoints ?? [];
}

async function fetchDailyRollup(
  dataType: string,
  date: string,
  token: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `${BASE}/dataTypes/${dataType}/dataPoints:dailyRollUp?date=${date}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  // dailyRollUp returns an array; grab the entry matching our date
  const entries: Record<string, unknown>[] = json.dataPoints ?? [];
  return entries.find((e) => e.date === date) ?? entries[0] ?? null;
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  if (!ADMIN_CONFIGURED) {
    return NextResponse.json({ connected: false, reason: "admin_not_configured" });
  }

  try {
    const db = getAdminDb();
    const tokenDoc = await db.doc(`users/${uid}/integrations/google_health`).get();

    if (!tokenDoc.exists) {
      return NextResponse.json({ connected: false });
    }

    const tokenData = tokenDoc.data()!;
    let accessToken: string = tokenData.access_token;

    if (Date.now() > tokenData.expires_at - 60000) {
      accessToken = await refreshAccessToken(tokenData.refresh_token);
      await tokenDoc.ref.update({
        access_token: accessToken,
        expires_at: Date.now() + 3600 * 1000,
      });
    }

    const today = new Date().toISOString().split("T")[0];
    // Sleep is typically from the previous night — fetch yesterday's sleep
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Fetch in parallel: yesterday's sleep session, today's steps rollup, today's exercises
    const [sleepPoints, stepsRollup, exercisePoints] = await Promise.all([
      fetchDataPoints(
        "sleep",
        new URLSearchParams({ startDate: yesterday, endDate: today }),
        accessToken
      ),
      fetchDailyRollup("steps", today, accessToken),
      fetchDataPoints(
        "exercise",
        new URLSearchParams({ startDate: today, endDate: today }),
        accessToken
      ),
    ]);

    // Parse the most recent sleep session
    const latestSleep = sleepPoints.at(-1) as Record<string, unknown> | undefined;
    const sleepVal = latestSleep?.value as Record<string, unknown> | undefined;
    const sleep_hours = sleepVal
      ? Math.round(((sleepVal.durationMillis as number) / 3600000) * 10) / 10
      : null;
    const sleep_efficiency = (sleepVal?.efficiency as number) ?? null;
    // Map efficiency (0-100) to quality (1-10)
    const sleep_quality = sleep_efficiency !== null
      ? Math.max(1, Math.min(10, Math.round(sleep_efficiency / 10)))
      : null;

    // Parse steps
    const stepsVal = stepsRollup?.value as Record<string, unknown> | undefined;
    const steps = (stepsVal?.intVal as number) ?? (stepsVal?.fpVal as number) ?? null;

    // Parse exercises
    const exercises = (exercisePoints as Record<string, unknown>[]).map((pt) => {
      const v = pt.value as Record<string, unknown> | undefined;
      return {
        name: (v?.activityType as string) ?? "Workout",
        duration_minutes: v?.durationMillis
          ? Math.round((v.durationMillis as number) / 60000)
          : null,
        calories: (v?.calories as number) ?? null,
      };
    });

    return NextResponse.json({
      connected: true,
      sleep_hours,
      sleep_quality,
      sleep_efficiency,
      steps,
      exercises,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Google Health data error:", err);
    return NextResponse.json({ connected: false, error: "Failed to fetch health data" });
  }
}

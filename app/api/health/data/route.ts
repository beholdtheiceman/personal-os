// GET /api/health/data?uid=... — fetches sleep, steps, and activity from Google Health API
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

async function refreshAccessToken(uid: string, refreshToken: string): Promise<string> {
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

  const db = getAdminDb();
  await db.doc(`users/${uid}/integrations/google_fit`).update({
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  });
  return data.access_token as string;
}

const BASE = "https://health.googleapis.com/v4/users/me";

async function fetchDataPoints(
  dataType: string,
  token: string,
  startTimeMs?: number,
  endTimeMs?: number,
): Promise<Record<string, unknown>[]> {
  const allPoints: Record<string, unknown>[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${BASE}/dataTypes/${dataType}/dataPoints`);
    // Server-side time filtering — avoids paginating through all historical data
    if (startTimeMs) url.searchParams.set("startTime", new Date(startTimeMs).toISOString());
    if (endTimeMs)   url.searchParams.set("endTime",   new Date(endTimeMs).toISOString());
    if (pageToken)   url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const raw = await res.json();
    if (!res.ok) {
      console.error(`Health API error for ${dataType}:`, res.status, raw);
      break;
    }
    const points = (raw.dataPoints ?? []) as Record<string, unknown>[];
    allPoints.push(...points);
    pageToken = raw.nextPageToken as string | undefined;
  } while (pageToken);

  return allPoints;
}

// Helper: get interval startTime from a data point (type-specific paths)
function getPointStartTime(pt: Record<string, unknown>, dataType: string): number {
  let startStr: string | undefined;
  if (dataType === "sleep") {
    startStr = (pt.sleep as Record<string, unknown> | undefined)?.interval
      ? ((pt.sleep as Record<string, unknown>).interval as Record<string, unknown>)?.startTime as string
      : undefined;
  } else if (dataType === "steps") {
    startStr = (pt.steps as Record<string, unknown> | undefined)?.interval
      ? ((pt.steps as Record<string, unknown>).interval as Record<string, unknown>)?.startTime as string
      : undefined;
  } else if (dataType === "exercise") {
    startStr = (pt.exercise as Record<string, unknown> | undefined)?.interval
      ? ((pt.exercise as Record<string, unknown>).interval as Record<string, unknown>)?.startTime as string
      : undefined;
  }
  return startStr ? new Date(startStr).getTime() : 0;
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  if (!ADMIN_CONFIGURED) {
    return NextResponse.json({ connected: false, reason: "admin_not_configured" });
  }

  try {
    const db = getAdminDb();
    const tokenDoc = await db.doc(`users/${uid}/integrations/google_fit`).get();

    if (!tokenDoc.exists || !tokenDoc.data()?.refresh_token) {
      return NextResponse.json({ connected: false });
    }

    const tokenData = tokenDoc.data()!;
    let token: string = tokenData.access_token;
    if (Date.now() > tokenData.expires_at - 60000) {
      token = await refreshAccessToken(uid, tokenData.refresh_token);
    }

    const now = new Date();
    // Use 24-hour lookback for steps/exercise — avoids UTC-midnight timezone drift
    // while still capturing a full day's worth of data.
    const stepsStart = now.getTime() - 24 * 3600000;
    const todayEnd = now.getTime();

    // Sleep window: yesterday 6 PM → today noon (covers overnight sleep)
    const sleepWindowStart = now.getTime() - 30 * 3600000;
    const sleepWindowEnd = now.getTime() + 12 * 3600000;

    // Heart rate: last 48h to ensure today's daily record is included
    const hrStart = now.getTime() - 48 * 3600000;

    // Today's date parts for heart rate matching
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1; // 1-indexed
    const todayDay = now.getDate();

    // Check Firestore cache — skip API if fetched within the last 15 minutes
    const cacheRef = db.doc(`users/${uid}/integrations/google_fit_cache`);
    const cacheSnap = await cacheRef.get();
    const cacheData = cacheSnap.exists ? cacheSnap.data()! : null;
    const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
    if (cacheData && cacheData.fetched_at && (now.getTime() - new Date(cacheData.fetched_at as string).getTime()) < CACHE_TTL_MS) {
      return NextResponse.json({ ...cacheData, connected: true, from_cache: true });
    }

    // Fetch all in parallel with server-side time filters — no more full history scan
    const [allSleep, allSteps, allExercise, allHr] = await Promise.all([
      fetchDataPoints("sleep",                     token, sleepWindowStart, sleepWindowEnd),
      fetchDataPoints("steps",                     token, stepsStart,       todayEnd),
      fetchDataPoints("exercise",                  token, stepsStart,       todayEnd),
      fetchDataPoints("daily-resting-heart-rate",  token, hrStart,          todayEnd),
    ]);

    // ── SLEEP ────────────────────────────────────────────────────────────────
    // Filter to sleep window, pick the most recent (longest) session
    const sleepPoints = allSleep.filter((pt) => {
      const t = getPointStartTime(pt, "sleep");
      return t >= sleepWindowStart && t <= sleepWindowEnd;
    });

    // Pick the sleep session with the most minutesAsleep
    let sleep_hours: number | null = null;
    let sleep_quality: number | null = null;
    let sleep_efficiency: number | null = null;

    if (sleepPoints.length > 0) {
      const best = sleepPoints.reduce((prev, cur) => {
        const prevMins = parseInt(
          ((prev.sleep as Record<string, unknown>)?.summary as Record<string, unknown>)
            ?.minutesAsleep as string ?? "0",
          10
        );
        const curMins = parseInt(
          ((cur.sleep as Record<string, unknown>)?.summary as Record<string, unknown>)
            ?.minutesAsleep as string ?? "0",
          10
        );
        return curMins > prevMins ? cur : prev;
      });

      const sleepData = best.sleep as Record<string, unknown> | undefined;
      const summary = sleepData?.summary as Record<string, unknown> | undefined;
      const minutesAsleep = summary?.minutesAsleep
        ? parseInt(summary.minutesAsleep as string, 10)
        : null;

      if (minutesAsleep !== null && minutesAsleep > 0) {
        sleep_hours = Math.round((minutesAsleep / 60) * 10) / 10;

        // Compute efficiency from stages if available
        const stages = (summary?.stagesSummary ?? []) as Array<Record<string, unknown>>;
        const totalMinutes = stages.reduce(
          (sum, s) => sum + parseInt(s.minutes as string ?? "0", 10),
          0
        );
        if (totalMinutes > 0) {
          // Efficiency = non-awake minutes / total minutes
          const awakeStage = stages.find((s) => (s.type as string)?.toLowerCase() === "awake");
          const awakeMins = awakeStage ? parseInt(awakeStage.minutes as string ?? "0", 10) : 0;
          const eff = Math.round(((totalMinutes - awakeMins) / totalMinutes) * 100);
          sleep_efficiency = eff;
          sleep_quality = Math.max(1, Math.min(10, Math.round(eff / 10)));
        }
      }
    }

    // ── STEPS ────────────────────────────────────────────────────────────────
    // Sum all step counts recorded today
    const todayStepPoints = allSteps.filter((pt) => {
      const t = getPointStartTime(pt, "steps");
      return t >= stepsStart && t <= todayEnd;
    });

    const steps: number | null = todayStepPoints.length > 0
      ? todayStepPoints.reduce((sum, pt) => {
          const stepsData = pt.steps as Record<string, unknown> | undefined;
          const count = stepsData?.count ? parseInt(stepsData.count as string, 10) : 0;
          return sum + (isNaN(count) ? 0 : count);
        }, 0)
      : null;

    // ── HEART RATE ───────────────────────────────────────────────────────────
    // Find today's resting heart rate record by date match
    const todayHr = allHr.find((pt) => {
      const hrData = pt.dailyRestingHeartRate as Record<string, unknown> | undefined;
      const date = hrData?.date as Record<string, unknown> | undefined;
      return (
        date &&
        Number(date.year) === todayYear &&
        Number(date.month) === todayMonth &&
        Number(date.day) === todayDay
      );
    });

    let resting_heart_rate: number | null = null;
    if (todayHr) {
      const hrData = todayHr.dailyRestingHeartRate as Record<string, unknown> | undefined;
      const bpm = hrData?.beatsPerMinute;
      if (bpm !== undefined) {
        const parsed = parseInt(bpm as string, 10);
        resting_heart_rate = isNaN(parsed) ? null : parsed;
      }
    }

    // ── EXERCISE ─────────────────────────────────────────────────────────────
    const todayExercisePoints = allExercise.filter((pt) => {
      const t = getPointStartTime(pt, "exercise");
      return t >= stepsStart && t <= todayEnd;
    });

    const exercises = todayExercisePoints.map((pt) => {
      const ex = pt.exercise as Record<string, unknown> | undefined;
      const name = (ex?.displayName as string) ?? "Workout";

      // activeDuration is a string like "1793s"
      let duration_minutes: number | null = null;
      if (ex?.activeDuration) {
        const durStr = ex.activeDuration as string;
        const seconds = parseFloat(durStr.replace("s", ""));
        if (!isNaN(seconds)) {
          duration_minutes = Math.round(seconds / 60);
        }
      }

      const metrics = ex?.metricsSummary as Record<string, unknown> | undefined;
      const calories = metrics?.caloriesKcal != null
        ? Math.round(metrics.caloriesKcal as number)
        : null;

      return { name, duration_minutes, calories };
    });

    const result = {
      connected: true,
      sleep_hours,
      sleep_quality,
      sleep_efficiency,
      steps,
      resting_heart_rate,
      exercises,
      fetched_at: new Date().toISOString(),
    };

    // Write cache (fire-and-forget — don't block the response)
    cacheRef.set(result).catch(() => {});

    return NextResponse.json(result);
  } catch (err) {
    console.error("Google Health data error:", err);
    return NextResponse.json({ connected: false, error: String(err) });
  }
}

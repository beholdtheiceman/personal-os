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
): Promise<Record<string, unknown>[]> {
  const allPoints: Record<string, unknown>[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${BASE}/dataTypes/${dataType}/dataPoints`);
    // Fetch the most recent 200 data points. The Health Connect REST API v4
    // does NOT accept startTime/endTime as query params — those cause a 400
    // INVALID_ARGUMENT. JavaScript-side time filtering (below) handles the
    // window instead.
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

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

// Compute a 0-100 readiness score mirroring Fitbit's three-factor model.
// Components with no data are dropped and the remaining weights are renormalized.
function computeReadiness(params: {
  todayRhr: number | null;
  rhrHistory: number[];   // past-week RHR values (excluding today)
  sleepHistory: number[]; // past-week sleep_quality values (1-10 scale)
  hrv: number | null;     // RMSSD ms — null when unavailable
}): number | null {
  const { todayRhr, rhrHistory, sleepHistory, hrv } = params;
  const components: { score: number; weight: number }[] = [];

  // RHR (35%): below 7-day baseline = recovering well, above = fatigued
  if (todayRhr !== null) {
    let rhrScore: number;
    if (rhrHistory.length >= 2) {
      const baseline = rhrHistory.reduce((a, b) => a + b, 0) / rhrHistory.length;
      rhrScore = Math.max(0, Math.min(100, 70 - (todayRhr - baseline) * 5));
    } else {
      // No baseline yet — score on absolute RHR (avg adult 60-80; lower = better)
      rhrScore = Math.max(0, Math.min(100, 120 - todayRhr));
    }
    components.push({ score: rhrScore, weight: 0.35 });
  }

  // Sleep (40%): avg quality over past 7 days
  if (sleepHistory.length > 0) {
    const avg = sleepHistory.reduce((a, b) => a + b, 0) / sleepHistory.length;
    components.push({ score: (avg / 10) * 100, weight: 0.40 });
  }

  // HRV (25%): RMSSD typical range 15-80ms — higher is better
  if (hrv !== null) {
    const hrvScore = Math.max(0, Math.min(100, ((hrv - 15) / 65) * 100));
    components.push({ score: hrvScore, weight: 0.25 });
  }

  if (components.length === 0) return null;
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  return Math.round(components.reduce((s, c) => s + c.score * (c.weight / totalWeight), 0));
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
    const cacheHasData = cacheData && (cacheData.sleep_hours != null || cacheData.steps != null || (cacheData.exercises as unknown[])?.length > 0);
    if (cacheHasData && cacheData.fetched_at && (now.getTime() - new Date(cacheData.fetched_at as string).getTime()) < CACHE_TTL_MS) {
      return NextResponse.json({ ...cacheData, connected: true, from_cache: true });
    }

    // Fetch recent data points + past-week health logs for readiness baseline in parallel.
    // HRV attempt is best-effort — many devices don't write it to Health Connect.
    const [allSleep, allSteps, allExercise, allHr, allHrv, historySnap] = await Promise.all([
      fetchDataPoints("sleep",                    token),
      fetchDataPoints("steps",                    token),
      fetchDataPoints("exercise",                 token),
      fetchDataPoints("daily-resting-heart-rate", token),
      fetchDataPoints("heart-rate-variability",   token).catch(() => []),
      db.collection(`users/${uid}/health`).orderBy("date", "desc").limit(7).get(),
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

    // ── READINESS ────────────────────────────────────────────────────────────
    // Extract 7-day RHR and sleep history from stored logs (excludes today).
    const rhrHistory: number[] = [];
    const sleepHistory: number[] = [];
    for (const doc of historySnap.docs) {
      const d = doc.data();
      if (d.resting_heart_rate != null) rhrHistory.push(d.resting_heart_rate as number);
      if (d.sleep_quality != null) sleepHistory.push(d.sleep_quality as number);
    }

    // Best HRV RMSSD reading from today's window (Health Connect stores ms)
    let hrv: number | null = null;
    if (allHrv.length > 0) {
      const todayHrvPoints = allHrv.filter((pt) => {
        const ts = (pt.heartRateVariabilityRmssd as Record<string, unknown> | undefined)
          ?.time as string | undefined;
        return ts ? new Date(ts).getTime() >= stepsStart : false;
      });
      if (todayHrvPoints.length > 0) {
        const val = (todayHrvPoints[0].heartRateVariabilityRmssd as Record<string, unknown> | undefined)
          ?.milliseconds;
        if (val !== undefined) hrv = parseFloat(val as string) || null;
      }
    }

    const readiness_score = computeReadiness({ todayRhr: resting_heart_rate, rhrHistory, sleepHistory, hrv });

    const result = {
      connected: true,
      sleep_hours,
      sleep_quality,
      sleep_efficiency,
      steps,
      resting_heart_rate,
      exercises,
      readiness_score,
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

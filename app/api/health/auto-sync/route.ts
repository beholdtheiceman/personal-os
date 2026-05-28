// GET /api/health/auto-sync — Vercel cron route
// Nightly: pulls Google Health data for all connected users and pre-populates
// their health log if they haven't manually logged today.
//
// POST /api/health/auto-sync — manual trigger (ID token auth)
// Called from the client to force-sync and log today's health data,
// even if a log already exists (uses merge so manual edits aren't wiped).
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";
import { getUserLocalDate, getLocalTimeInfo } from "@/lib/timezone";

interface HealthDataResponse {
  connected: boolean;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  sleep_efficiency?: number | null;
  steps?: number | null;
  resting_heart_rate?: number | null;
  readiness_score?: number | null;
  exercises?: Array<{ name: string; duration_minutes: number | null; calories: number | null }>;
  [key: string]: unknown;
}

// ── Shared: build a health log doc from Google Health API data ─────────────

function buildHealthLog(today: string, data: HealthDataResponse) {
  const readiness_score = typeof data.readiness_score === "number" ? data.readiness_score : null;
  const energy_level = readiness_score !== null ? Math.max(1, Math.round(readiness_score / 10)) : 5;
  const noteParts: string[] = ["Auto-synced"];
  if (data.steps != null) noteParts.push(`${(data.steps as number).toLocaleString()} steps`);
  if (data.resting_heart_rate != null) noteParts.push(`${data.resting_heart_rate} bpm resting HR`);
  const exerciseNames = data.exercises?.map((e) => e.name).join(", ") ?? "";

  return {
    date: today,
    sleep_hours: data.sleep_hours ?? 0,
    sleep_quality: data.sleep_quality ?? 5,
    ...(data.sleep_efficiency != null && { sleep_efficiency: data.sleep_efficiency }),
    exercise_done: (data.exercises?.length ?? 0) > 0,
    exercise_description: exerciseNames,
    energy_level,
    ...(readiness_score !== null && { readiness_score }),
    notes: noteParts.join(" · "),
    logged_at: new Date().toISOString(),
  };
}

// ── POST — manual client-triggered sync + log ──────────────────────────────

export async function POST(req: NextRequest) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(auth.slice(7));
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use req.nextUrl.origin — always the correct URL for the current deployment,
  // no dependency on VERCEL_URL or custom domain configuration.
  const origin = req.nextUrl.origin;
  let data: HealthDataResponse;
  try {
    const res = await fetch(`${origin}/api/health/data?uid=${uid}`);
    if (!res.ok) throw new Error(`data endpoint returned ${res.status}`);
    data = (await res.json()) as HealthDataResponse;
  } catch (err) {
    console.error("manual sync: failed to fetch health data", err);
    return NextResponse.json(
      { error: "Failed to fetch health data from Google Health" },
      { status: 502 }
    );
  }

  if (!data.connected) {
    return NextResponse.json(
      { error: "Google Health not connected — please connect your account first" },
      { status: 400 }
    );
  }

  try {
    const timeInfo = await getLocalTimeInfo(uid);
    const today = timeInfo.localDate;
    const db = getAdminDb();
    const logDoc = buildHealthLog(today, data);
    // merge: true so that any manually edited fields aren't fully overwritten
    await db.doc(`users/${uid}/health/${today}`).set(logDoc, { merge: true });
    return NextResponse.json({ ok: true, ...logDoc });
  } catch (err) {
    console.error("manual sync: failed to write health log", err);
    return NextResponse.json({ error: "Failed to write health log" }, { status: 500 });
  }
}

// ── GET — Vercel cron (all users) ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const cronSecret = getEnv("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // req.nextUrl.origin is always the correct deployment URL — avoids the stale
  // VERCEL_URL pattern where the env var can lag behind the current deployment.
  const origin = req.nextUrl.origin;

  const db = getAdminDb();
  let checked = 0;
  let synced = 0;
  let skipped = 0;

  try {
    const usersSnap = await db.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      checked++;
      const today = await getUserLocalDate(uid);

      // ── Check google_fit integration ─────────────────────────────────────
      const fitDoc = await db.doc(`users/${uid}/integrations/google_fit`).get();
      if (!fitDoc.exists || !fitDoc.data()?.refresh_token) {
        skipped++;
        continue;
      }

      // ── Skip if already manually logged today ────────────────────────────
      const logRef = db.doc(`users/${uid}/health/${today}`);
      const logSnap = await logRef.get();
      if (logSnap.exists) {
        skipped++;
        continue;
      }

      // ── Fetch health data via internal API ───────────────────────────────
      let data: HealthDataResponse;
      try {
        const res = await fetch(`${origin}/api/health/data?uid=${uid}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        data = (await res.json()) as HealthDataResponse;
      } catch (err) {
        console.error(`auto-sync: health data fetch failed for ${uid}:`, err);
        skipped++;
        continue;
      }

      if (data.connected !== true) {
        skipped++;
        continue;
      }

      // ── Write pre-populated health log ───────────────────────────────────
      const logDoc = buildHealthLog(today, data);
      await logRef.set(logDoc);
      synced++;
    }

    return NextResponse.json({ checked, synced, skipped });
  } catch (err) {
    console.error("auto-sync error:", err);
    return NextResponse.json(
      { error: String(err), checked, synced, skipped },
      { status: 500 },
    );
  }
}

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
import { recordCronRun } from "@/lib/cron-log";

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
    auto_synced: true,
  };
}

// Partial update used to refresh an existing *auto-synced* log as the day's
// data improves. Only includes fields Google actually returned, so a later run
// with missing data can't clobber good values with defaults. Never touches a
// manually-entered log (those carry auto_synced: false / no flag).
function buildHealthLogRefresh(data: HealthDataResponse) {
  const out: Record<string, unknown> = {
    logged_at: new Date().toISOString(),
    auto_synced: true,
  };
  if (data.sleep_hours != null) out.sleep_hours = data.sleep_hours;
  if (data.sleep_quality != null) out.sleep_quality = data.sleep_quality;
  if (data.sleep_efficiency != null) out.sleep_efficiency = data.sleep_efficiency;
  if ((data.exercises?.length ?? 0) > 0) {
    out.exercise_done = true;
    out.exercise_description = data.exercises!.map((e) => e.name).join(", ");
  }
  if (typeof data.readiness_score === "number") {
    out.readiness_score = data.readiness_score;
    out.energy_level = Math.max(1, Math.round(data.readiness_score / 10));
  }
  const noteParts: string[] = ["Auto-synced"];
  if (data.steps != null) noteParts.push(`${(data.steps as number).toLocaleString()} steps`);
  if (data.resting_heart_rate != null) noteParts.push(`${data.resting_heart_rate} bpm resting HR`);
  out.notes = noteParts.join(" · ");
  return out;
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
  let created = 0;
  let refreshed = 0;
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

      // ── Respect manual logs; refresh our own auto logs ───────────────────
      // Runs several times a day. A manually entered/edited log
      // (auto_synced !== true) is never touched. A prior auto-sync is refreshed
      // as the day's wearable data arrives.
      const logRef = db.doc(`users/${uid}/health/${today}`);
      const logSnap = await logRef.get();
      const existing = logSnap.exists ? logSnap.data() : null;
      if (existing && existing.auto_synced !== true) {
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

      // ── Create or refresh the health log ─────────────────────────────────
      if (existing) {
        await logRef.set(buildHealthLogRefresh(data), { merge: true });
        refreshed++;
      } else {
        await logRef.set(buildHealthLog(today, data));
        created++;
      }
    }

    await recordCronRun("health-sync", "ok", { checked, created, refreshed, skipped });
    return NextResponse.json({ checked, created, refreshed, skipped });
  } catch (err) {
    console.error("auto-sync error:", err);
    await recordCronRun("health-sync", "error", {
      error: String(err),
      checked,
      created,
      refreshed,
      skipped,
    });
    return NextResponse.json(
      { error: String(err), checked, created, refreshed, skipped },
      { status: 500 },
    );
  }
}

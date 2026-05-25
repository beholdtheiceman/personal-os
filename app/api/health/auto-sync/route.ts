// GET /api/health/auto-sync — Vercel cron route
// Nightly: pulls Google Health data for all connected users and pre-populates
// their health log if they haven't manually logged today.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";
import { getUserLocalDate } from "@/lib/timezone";

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

interface HealthDataResponse {
  connected: boolean;
  sleep_hours?: number | null;
  sleep_quality?: number | null;
  steps?: number | null;
  resting_heart_rate?: number | null;
  exercises?: Array<{ name: string; duration_minutes: number | null; calories: number | null }>;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  // ── Auth check ─────────────────────────────────────────────────────────────
  const cronSecret = getEnv("CRON_SECRET");
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = getAdminDb();
  let checked = 0;
  let synced = 0;
  let skipped = 0;

  try {
    const usersSnap = await db.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      checked++;
      // Compute today in the user's local timezone — server runs UTC on Vercel.
      const today = await getUserLocalDate(uid);

      // ── Check google_fit integration ───────────────────────────────────────
      const fitDoc = await db.doc(`users/${uid}/integrations/google_fit`).get();
      if (!fitDoc.exists || !fitDoc.data()?.refresh_token) {
        skipped++;
        continue;
      }

      // ── Fetch health data via internal API ─────────────────────────────────
      let data: HealthDataResponse;
      try {
        const res = await fetch(`${baseUrl}/api/health/data?uid=${uid}`);
        if (!res.ok) {
          skipped++;
          continue;
        }
        data = (await res.json()) as HealthDataResponse;
      } catch {
        skipped++;
        continue;
      }

      if (data.connected !== true) {
        skipped++;
        continue;
      }

      // ── Skip if already manually logged today ──────────────────────────────
      const logRef = db.doc(`users/${uid}/health/${today}`);
      const logSnap = await logRef.get();
      if (logSnap.exists) {
        skipped++;
        continue;
      }

      // ── Compute energy_level from readiness (backward compat for AI routes) ─
      const readiness_score = typeof data.readiness_score === "number" ? data.readiness_score : null;
      const energy_level = readiness_score !== null ? Math.max(1, Math.round(readiness_score / 10)) : 5;

      // ── Build notes string from available data ─────────────────────────────
      const noteParts: string[] = ["Auto-synced"];
      if (data.steps != null) {
        noteParts.push(`${data.steps.toLocaleString()} steps`);
      }
      if (data.resting_heart_rate != null) {
        noteParts.push(`${data.resting_heart_rate} bpm resting HR`);
      }
      const notes = noteParts.join(" · ");

      // ── Write pre-populated health log ─────────────────────────────────────
      const exerciseNames = data.exercises?.map((e) => e.name).join(", ") ?? "";

      await logRef.set({
        date: today,
        sleep_hours: data.sleep_hours ?? 0,
        sleep_quality: data.sleep_quality ?? 5,
        exercise_done: (data.exercises?.length ?? 0) > 0,
        exercise_description: exerciseNames,
        energy_level,
        ...(readiness_score !== null && { readiness_score }),
        notes,
        logged_at: new Date().toISOString(),
      });

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

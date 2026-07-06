// POST /api/rate-tracker/sync — manual trigger (ID token auth)
// GET  /api/rate-tracker/sync — cron trigger (CRON_SECRET auth)
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { CRON_SECRET } from "@/lib/env";
import { syncOffers, syncBenchmarkRates } from "@/lib/rate-tracker";

function isCronAuthed(req: NextRequest) {
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

async function run() {
  const [offersResult, rates] = await Promise.all([syncOffers(), syncBenchmarkRates()]);
  return { ...offersResult, benchmark_rates: rates ? "updated" : "skipped (no FRED_API_KEY)" };
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await run());
  } catch (err) {
    console.error("Rate tracker sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await run());
  } catch (err) {
    console.error("Rate tracker cron error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

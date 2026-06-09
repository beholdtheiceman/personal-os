// POST /api/ingest/day-recap — End-of-Day Recap (PA-2)
// Thin HTTP wrapper around lib/day-recap.ts runDayRecap(); the recap logic is shared
// with the run_day_recap chat tool so both surfaces behave identically.
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { runDayRecap } from "@/lib/day-recap";

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

  const { text, localDate } = await req.json() as { text: string; localDate?: string };
  if (!text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const today = localDate ?? new Date().toISOString().slice(0, 10);

  try {
    const result = await runDayRecap(uid, text, today);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Day recap error:", err);
    return NextResponse.json({ error: "Failed to process recap" }, { status: 500 });
  }
}

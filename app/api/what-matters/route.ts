// POST /api/what-matters — manual trigger (Firebase ID token auth)
// GET  /api/what-matters — cron trigger (CRON_SECRET auth), runs for all users
//                        — or client fetch (ID token auth), returns stored signal
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { CRON_SECRET } from "@/lib/env";
import { generateWhatMatters, getWhatMatters } from "@/lib/what-matters";

function isCronAuthed(req: NextRequest): boolean {
  return (req.headers.get("Authorization") ?? "") === `Bearer ${CRON_SECRET}`;
}

async function getUidFromToken(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    if (token === CRON_SECRET) return null;
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

// POST — manual trigger for one user (refresh)
export async function POST(req: NextRequest) {
  const uid = await getUidFromToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const content = await generateWhatMatters(uid);
    return NextResponse.json({ success: true, content });
  } catch (err) {
    console.error("[what-matters] POST error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}

// GET — cron (all users) or client fetch (return stored signal)
export async function GET(req: NextRequest) {
  // Cron path
  if (isCronAuthed(req)) {
    const db = getAdminDb();
    const usersSnap = await db.collection("users").get();
    const results: { uid: string; ok: boolean }[] = [];

    await Promise.allSettled(
      usersSnap.docs.map(async (userDoc) => {
        const uid = userDoc.id;
        try {
          await generateWhatMatters(uid);
          results.push({ uid, ok: true });
        } catch {
          results.push({ uid, ok: false });
        }
      })
    );

    return NextResponse.json({ ok: true, results });
  }

  // Client fetch — return today's stored signal
  const uid = await getUidFromToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await getWhatMatters(uid);
  return NextResponse.json({ doc: doc ?? null });
}

// POST /api/system-audit — manual trigger (Firebase ID token auth)
// GET  /api/system-audit — cron (CRON_SECRET auth) or client fetch (ID token auth)
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { CRON_SECRET } from "@/lib/env";
import { generateSystemAudit, getSystemAudit } from "@/lib/system-audit";

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

export async function POST(req: NextRequest) {
  const uid = await getUidFromToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const doc = await generateSystemAudit(uid);
    return NextResponse.json({ success: true, doc });
  } catch (err) {
    console.error("[system-audit] POST error:", err);
    return NextResponse.json({ error: "Audit generation failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (isCronAuthed(req)) {
    const db = getAdminDb();
    const usersSnap = await db.collection("users").get();
    const results: { uid: string; ok: boolean }[] = [];

    await Promise.allSettled(
      usersSnap.docs.map(async (userDoc) => {
        try {
          await generateSystemAudit(userDoc.id);
          results.push({ uid: userDoc.id, ok: true });
        } catch {
          results.push({ uid: userDoc.id, ok: false });
        }
      })
    );

    return NextResponse.json({ ok: true, results });
  }

  const uid = await getUidFromToken(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await getSystemAudit(uid);
  return NextResponse.json({ doc: doc ?? null });
}

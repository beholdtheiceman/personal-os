import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

async function getUid(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const decoded = await getAdminAuth().verifyIdToken(auth.slice(7));
    return decoded.uid;
  } catch { return null; }
}

// POST /api/rate-tracker/taken  { offerId }  — toggle taken/untaken
export async function POST(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { offerId } = await req.json() as { offerId: string };
  if (!offerId) return NextResponse.json({ error: "offerId required" }, { status: 400 });
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/rate_taken/${offerId}`);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.delete();
    return NextResponse.json({ taken: false });
  }
  await ref.set({ taken_at: new Date().toISOString() });
  return NextResponse.json({ taken: true });
}

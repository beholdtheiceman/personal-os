import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import type { RateProfile } from "@/lib/rate-tracker";

async function getUid(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const decoded = await getAdminAuth().verifyIdToken(auth.slice(7));
    return decoded.uid;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getAdminDb();
  const snap = await db.doc(`users/${uid}/settings/rate_profile`).get();
  return NextResponse.json({ profile: snap.exists ? snap.data() : null });
}

export async function POST(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as Partial<RateProfile>;
  const profile: RateProfile = {
    existing_institutions: body.existing_institutions ?? [],
    cards_opened_24mo: body.cards_opened_24mo ?? 0,
    current_cards: body.current_cards ?? [],
    deployable_balance: body.deployable_balance ?? 0,
    updated_at: new Date().toISOString(),
  };
  const db = getAdminDb();
  await db.doc(`users/${uid}/settings/rate_profile`).set(profile);
  return NextResponse.json({ profile });
}

export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { updateLifeContext } from "@/lib/life-context";

async function getUidFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return null;
    const decoded = await getAdminAuth().verifyIdToken(auth.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    weekDataSummary?: string;
    reviewContent?: string;
  };

  let weekDataSummary = body.weekDataSummary ?? "Manual update trigger.";
  let reviewContent = body.reviewContent ?? "";

  if (!reviewContent) {
    try {
      const snap = await getAdminDb().doc(`users/${uid}/weekly_reviews/latest`).get();
      reviewContent = (snap.data()?.content as string) ?? "";
    } catch {
      reviewContent = "";
    }
  }

  await updateLifeContext(uid, weekDataSummary, reviewContent);

  const snap = await getAdminDb().doc(`users/${uid}/life_context/main`).get();
  return NextResponse.json({ success: true, doc: snap.data() ?? null });
}

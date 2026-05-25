// GET /api/news/feed — Returns paginated news items for the authenticated user.
// PATCH /api/news/feed — Updates status (read / saved / dismissed) on a single item.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

async function getUid(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(auth.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? "unread";
  const tag    = searchParams.get("tag");
  const lim    = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const db = getAdminDb();
  const col = db.collection(`users/${uid}/news_items`);

  try {
    // No composite orderBy — sort in memory to avoid requiring a Firestore index
    const q = tag
      ? col.where("status", "==", status).where("tags", "array-contains", tag)
      : col.where("status", "==", status);

    const snap = await q.limit(lim).get();
    const items = snap.docs
      .map((d) => d.data())
      .sort((a, b) =>
        (b.relevance_score - a.relevance_score) ||
        (b.fetched_at < a.fetched_at ? -1 : 1)
      );

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[news/feed] query failed:", err);
    return NextResponse.json({ error: "Failed to load feed", items: [] }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, status, starred } = body;

  const VALID_STATUSES = new Set(["unread", "read", "saved", "dismissed"]);
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (status !== undefined && !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (status !== undefined) {
    update.status = status;
    if (status === "saved") update.saved_at = new Date().toISOString();
  }
  if (starred !== undefined && typeof starred === "boolean") {
    update.starred = starred;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = getAdminDb();
  await db.doc(`users/${uid}/news_items/${id}`).update(update);
  return NextResponse.json({ ok: true });
}

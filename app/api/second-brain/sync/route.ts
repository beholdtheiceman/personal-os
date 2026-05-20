// POST /api/second-brain/sync
// Accepts an array of {path, content} objects and stores them in Firestore
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(auth);
    const uid = decoded.uid;

    const { files }: { files: { path: string; content: string }[] } = await req.json();
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const db = getAdminDb();
    const batch = db.batch();
    const syncedAt = new Date().toISOString();
    const col = db.collection(`users/${uid}/second_brain`);

    // Delete existing docs first
    const existing = await col.get();
    existing.docs.forEach((d) => batch.delete(d.ref));

    // Write new docs
    files.forEach(({ path, content }) => {
      const ref = col.doc();
      batch.set(ref, {
        path,
        filename: path.split(/[/\\]/).pop() ?? path,
        content,
        syncedAt,
      });
    });

    await batch.commit();

    return NextResponse.json({ synced: files.length, syncedAt });
  } catch (err) {
    console.error("Second brain sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

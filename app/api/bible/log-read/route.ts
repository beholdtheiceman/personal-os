// POST /api/bible/log-read — Log a passage-read event to users/{uid}/bible_reading.
// Called by the Bible reader UI when a chapter loads. Fire-and-forget on the client.
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json()) as {
      book?: string;
      chapter?: number;
      verse_start?: number;
      verse_end?: number;
      translation?: string;
    };

    if (!body.book || typeof body.chapter !== "number") {
      return NextResponse.json({ error: "Missing book or chapter" }, { status: 400 });
    }

    const ref =
      body.verse_start && body.verse_end && body.verse_start !== body.verse_end
        ? `${body.book} ${body.chapter}:${body.verse_start}-${body.verse_end}`
        : body.verse_start
          ? `${body.book} ${body.chapter}:${body.verse_start}`
          : `${body.book} ${body.chapter}`;

    await getAdminDb().collection(`users/${decoded.uid}/bible_reading`).add({
      reference: ref,
      book: body.book,
      chapter: body.chapter,
      verse_start: body.verse_start ?? null,
      verse_end: body.verse_end ?? null,
      translation: body.translation ?? "NET",
      read_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[bible/log-read] error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

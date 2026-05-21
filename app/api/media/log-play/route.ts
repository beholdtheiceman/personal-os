// POST /api/media/log-play — Log a media play event to users/{uid}/media_history.
// Called by the PlayerContext whenever play() is invoked. Fire-and-forget on the client.
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
      type?: string;
      title?: string;
      source_id?: string;
      channel?: string;
      thumbnail?: string;
    };

    if (body.type !== "youtube" && body.type !== "suno") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    if (!body.title || !body.source_id) {
      return NextResponse.json({ error: "Missing title or source_id" }, { status: 400 });
    }

    await getAdminDb().collection(`users/${decoded.uid}/media_history`).add({
      type: body.type,
      title: body.title.slice(0, 500),
      source_id: body.source_id.slice(0, 2000),
      channel: body.channel ? body.channel.slice(0, 300) : null,
      thumbnail: body.thumbnail ? body.thumbnail.slice(0, 1000) : null,
      played_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[media/log-play] error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

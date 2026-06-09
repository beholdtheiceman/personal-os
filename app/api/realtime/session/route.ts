import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { buildContextSnapshot } from "@/lib/context-snapshot";

export async function POST(req: NextRequest) {
  const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Realtime voice not configured" }, { status: 503 });
  }

  // The client passes its local date + IANA timezone so the snapshot's calendar query
  // covers the right local day. Both are optional; buildContextSnapshot defaults to UTC/today.
  let localDate: string | undefined;
  let tz: string | undefined;
  try {
    const body = await req.json();
    localDate = typeof body?.localDate === "string" ? body.localDate : undefined;
    tz = typeof body?.tz === "string" ? body.tz : undefined;
  } catch {
    // No/invalid body — fall back to defaults.
  }

  // Build the snapshot in parallel with the OpenAI session request so it adds no extra
  // serial latency to session start. Best-effort: a failure just omits the snapshot.
  const [res, snapshot] = await Promise.all([
    fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
    buildContextSnapshot(uid, localDate, tz).catch(() => null),
  ]);

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI Realtime session error:", err);
    return NextResponse.json({ error: "Failed to create realtime session" }, { status: res.status });
  }

  // client_secrets endpoint returns { value, expires_at, ... } at the top level
  const data = await res.json() as { value: string; expires_at: number };
  return NextResponse.json({ client_secret: { value: data.value, expires_at: data.expires_at }, snapshot });
}

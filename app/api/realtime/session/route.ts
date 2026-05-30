import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Realtime voice not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));

  const ALLOWED_MODELS = new Set(["gpt-4o-realtime-preview-2024-12-17"]);
  const ALLOWED_VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);

  const model = ALLOWED_MODELS.has(body.model as string) ? (body.model as string) : "gpt-4o-realtime-preview-2024-12-17";
  const voice = ALLOWED_VOICES.has(body.voice as string) ? (body.voice as string) : "alloy";

  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, voice }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI Realtime session error:", err);
    return NextResponse.json({ error: "Failed to create realtime session" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}

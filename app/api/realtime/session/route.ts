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

  const { voice } = await req.json().catch(() => ({ voice: "alloy" }));

  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-4o-realtime-preview", voice: voice ?? "alloy" }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI Realtime session error:", err);
    return NextResponse.json({ error: "Failed to create realtime session" }, { status: res.status });
  }

  const data = await res.json() as { client_secret: { value: string; expires_at: number } };
  return NextResponse.json({ client_secret: data.client_secret });
}

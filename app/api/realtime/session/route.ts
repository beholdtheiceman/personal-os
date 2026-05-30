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

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI Realtime session error:", err);
    return NextResponse.json({ error: "Failed to create realtime session" }, { status: res.status });
  }

  // New API returns { value, expires_at, session }
  // Normalize to { client_secret: { value } } so the component stays unchanged
  const data = await res.json() as { value: string; expires_at: number };
  return NextResponse.json({ client_secret: { value: data.value, expires_at: data.expires_at } });
}

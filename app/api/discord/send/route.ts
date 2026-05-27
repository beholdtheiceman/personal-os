// POST /api/discord/send — send a message to a channel
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

const BASE = "https://discord.com/api/v10";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  try {
    await getAdminAuth().verifyIdToken(authHeader.replace("Bearer ", ""));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { channelId, content } = await req.json();
  if (!channelId || !content) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "Discord bot not configured" }, { status: 500 });

  try {
    const res = await fetch(`${BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Failed to send message");
    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[discord/send]", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

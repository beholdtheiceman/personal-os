// GET /api/discord/messages?channelId=...&before=... — fetch messages from a channel
import { NextRequest, NextResponse } from "next/server";

const BASE = "https://discord.com/api/v10";

export async function GET(req: NextRequest) {
  const channelId = req.nextUrl.searchParams.get("channelId");
  const before = req.nextUrl.searchParams.get("before");
  if (!channelId) return NextResponse.json({ error: "Missing channelId" }, { status: 400 });

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "Discord bot not configured" }, { status: 500 });

  try {
    const params = new URLSearchParams({ limit: "50" });
    if (before) params.set("before", before);

    const res = await fetch(`${BASE}/channels/${channelId}/messages?${params}`, {
      headers: { Authorization: `Bot ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Discord API error");

    const messages = data.map((m: {
      id: string;
      content: string;
      timestamp: string;
      author: { id: string; username: string; avatar: string | null };
      attachments: { url: string; filename: string }[];
    }) => ({
      id: m.id,
      content: m.content,
      timestamp: m.timestamp,
      author: {
        id: m.author.id,
        username: m.author.username,
        avatar: m.author.avatar
          ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png`
          : null,
      },
      attachments: m.attachments.map((a) => ({ url: a.url, filename: a.filename })),
    }));

    return NextResponse.json(messages);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

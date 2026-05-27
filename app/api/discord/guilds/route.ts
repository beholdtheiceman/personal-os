// GET /api/discord/guilds — list all guilds the bot is in
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

const BASE = "https://discord.com/api/v10";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  try {
    await getAdminAuth().verifyIdToken(authHeader.replace("Bearer ", ""));
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "Discord bot not configured" }, { status: 500 });

  try {
    const res = await fetch(`${BASE}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${token}` },
      next: { revalidate: 60 },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Discord API error");

    return NextResponse.json(
      data.map((g: { id: string; name: string; icon: string | null }) => ({
        id: g.id,
        name: g.name,
        icon: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
          : null,
      }))
    );
  } catch (err) {
    console.error("[discord/guilds]", err);
    return NextResponse.json({ error: "Failed to fetch guilds" }, { status: 500 });
  }
}

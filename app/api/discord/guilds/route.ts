// GET /api/discord/guilds — list all guilds the bot is in
import { NextResponse } from "next/server";

const BASE = "https://discord.com/api/v10";

export async function GET() {
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
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

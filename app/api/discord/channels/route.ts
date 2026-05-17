// GET /api/discord/channels?guildId=... — list text channels in a guild
import { NextRequest, NextResponse } from "next/server";

const BASE = "https://discord.com/api/v10";

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
}

export async function GET(req: NextRequest) {
  const guildId = req.nextUrl.searchParams.get("guildId");
  if (!guildId) return NextResponse.json({ error: "Missing guildId" }, { status: 400 });

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "Discord bot not configured" }, { status: 500 });

  try {
    const res = await fetch(`${BASE}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
      next: { revalidate: 30 },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Discord API error");

    // Type 0 = text channel, Type 4 = category
    const channels: DiscordChannel[] = data;
    const categories = channels
      .filter((c) => c.type === 4)
      .sort((a, b) => a.position - b.position);

    const textChannels = channels
      .filter((c) => c.type === 0)
      .sort((a, b) => a.position - b.position);

    // Group text channels under their categories
    const grouped = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      channels: textChannels.filter((c) => c.parent_id === cat.id),
    }));

    // Channels with no category
    const uncategorized = textChannels.filter((c) => !c.parent_id);
    if (uncategorized.length) {
      grouped.unshift({ id: "uncategorized", name: "Channels", channels: uncategorized });
    }

    return NextResponse.json(grouped);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

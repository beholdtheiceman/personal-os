// GET /api/gmail/messages?uid=... — fetches recent Gmail messages
import { NextRequest, NextResponse } from "next/server";
import { refreshGmailToken } from "@/lib/gmail-token";

function parseFrom(raw: string) {
  const match = raw.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: raw, email: raw };
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const maxResults = parseInt(req.nextUrl.searchParams.get("max") ?? "50");
  const labelIds = req.nextUrl.searchParams.get("labels") ?? "INBOX";

  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  try {
    const accessToken = await refreshGmailToken(uid);
    const auth = { Authorization: `Bearer ${accessToken}` };

    // List message IDs
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=${labelIds}`,
      { headers: auth }
    );
    const listData = await listRes.json();
    if (listData.error) return NextResponse.json({ connected: false, messages: [] });

    const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);

    // Fetch metadata for each message in parallel (batched to avoid rate limits)
    const BATCH = 20;
    const messages = [];
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((id) =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: auth }
          ).then((r) => r.json())
        )
      );

      for (const msg of results) {
        if (msg.error) continue;
        const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
        const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
        const from = parseFrom(get("From"));
        messages.push({
          id: msg.id,
          threadId: msg.threadId,
          subject: get("Subject") || "(no subject)",
          from: from.name || from.email,
          fromEmail: from.email,
          date: get("Date"),
          snippet: msg.snippet ?? "",
          read: !msg.labelIds?.includes("UNREAD"),
          labels: msg.labelIds ?? [],
        });
      }
    }

    return NextResponse.json({ connected: true, messages });
  } catch (err) {
    console.error("Gmail messages error:", err);
    return NextResponse.json({ connected: false, messages: [], error: String(err) });
  }
}

// POST /api/gmail/analyze — inbox summary + unsubscribe recommendations
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { refreshGmailToken } from "@/lib/gmail-token";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

function parseFrom(raw: string) {
  const match = raw.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: raw, email: raw };
}

export async function POST(req: NextRequest) {
  // Auth: Firebase ID token
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    const uid = decoded.uid;

    // Fetch last 75 inbox messages metadata
    const accessToken = await refreshGmailToken(uid);
    const auth = { Authorization: `Bearer ${accessToken}` };

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=75&labelIds=INBOX`,
      { headers: auth }
    );
    const listData = await listRes.json();
    if (listData.error) throw new Error(listData.error.message);

    const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);
    if (ids.length === 0) {
      return NextResponse.json({ summary: "Your inbox is empty.", unsubscribe: [] });
    }

    // Fetch metadata in batches of 20
    const BATCH = 20;
    const emails: { from: string; fromEmail: string; subject: string; snippet: string; read: boolean }[] = [];

    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((id) =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata` +
              `&metadataHeaders=Subject&metadataHeaders=From`,
            { headers: auth }
          ).then((r) => r.json())
        )
      );
      for (const msg of results) {
        if (msg.error) continue;
        const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
        const get = (n: string) =>
          headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
        const { name, email } = parseFrom(get("From"));
        emails.push({
          from:      name || email,
          fromEmail: email,
          subject:   get("Subject") || "(no subject)",
          snippet:   msg.snippet ?? "",
          read:      !(msg.labelIds ?? []).includes("UNREAD"),
        });
      }
    }

    // Build the prompt
    const emailList = emails
      .map((e, i) => `${i + 1}. From: ${e.from} <${e.fromEmail}>\n   Subject: ${e.subject}\n   Preview: ${e.snippet.slice(0, 120)}`)
      .join("\n\n");

    const prompt = `You are analyzing someone's email inbox. Here are their ${emails.length} most recent inbox messages:

${emailList}

Respond with a JSON object in exactly this format (no markdown fences, no extra text):
{
  "summary": "2-4 sentence plain English overview of what's going on in the inbox — themes, important-looking messages, general activity level. Be specific and useful, not generic.",
  "unsubscribe": [
    {
      "sender": "Display name",
      "email": "sender@domain.com",
      "reason": "One sentence explaining why (e.g. 'Promotional emails from a retailer — 5 messages this week')"
    }
  ]
}

For the unsubscribe list: identify senders that appear to be newsletters, marketing lists, promotional blasts, or recurring automated emails the user probably doesn't read. Focus on senders with multiple messages or obvious bulk-mail patterns. List up to 10. Do not include transactional emails (receipts, order confirmations, account security). Do not include personal senders.`;

    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content[0]?.type === "text" ? res.content[0].text.trim() : "{}";
    const clean = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

    let parsed: { summary: string; unsubscribe: { sender: string; email: string; reason: string }[] };
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = { summary: text, unsubscribe: [] };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[gmail/analyze] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

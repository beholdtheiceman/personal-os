// GET /api/gmail/unsubscribe-scan?uid=...
// Scans inbox for senders that include a List-Unsubscribe header,
// deduplicates by sender address, returns one entry per sender.
import { NextRequest, NextResponse } from "next/server";
import { refreshGmailToken } from "@/lib/gmail-token";

export interface UnsubscribeCandidate {
  emailId: string;       // most recent email ID from this sender (used to unsubscribe)
  sender: string;        // display name + address e.g. "Mailchimp <news@mc.com>"
  senderEmail: string;   // just the address
  senderName: string;    // just the display name (falls back to address)
  subject: string;       // subject of most recent email
  date: string;
  count: number;         // total emails found from this sender
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  try {
    const accessToken = await refreshGmailToken(uid);

    // Search promotions + emails containing unsubscribe — fetch up to 200
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=category:promotions OR unsubscribe&maxResults=200`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    if (listData.error) return NextResponse.json({ error: listData.error.message }, { status: 400 });

    const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id);
    if (ids.length === 0) return NextResponse.json({ candidates: [] });

    // Batch fetch metadata (50 at a time to avoid rate limits)
    const BATCH = 50;
    const allMeta: Record<string, unknown>[] = [];
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((id) =>
          fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata` +
            `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          ).then((r) => r.json())
        )
      );
      allMeta.push(...results.filter((m) => !m.error));
    }

    // Keep only emails that have a List-Unsubscribe header
    const withUnsub = allMeta.filter((msg) => {
      const headers: { name: string; value: string }[] = (msg as Record<string, unknown> & { payload?: { headers?: { name: string; value: string }[] } }).payload?.headers ?? [];
      return headers.some((h) => h.name.toLowerCase() === "list-unsubscribe");
    });

    // Deduplicate by normalized sender email address
    const byEmail = new Map<string, UnsubscribeCandidate>();

    for (const msg of withUnsub) {
      const msgTyped = msg as Record<string, unknown> & { id: string; payload?: { headers?: { name: string; value: string }[] } };
      const headers: { name: string; value: string }[] = msgTyped.payload?.headers ?? [];
      const get = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

      const fromRaw = get("From");
      // Parse "Display Name <email@addr>" or just "email@addr"
      const addrMatch = fromRaw.match(/<([^>]+)>/);
      const senderEmail = (addrMatch?.[1] ?? fromRaw).toLowerCase().trim();
      const senderName = addrMatch ? fromRaw.replace(/<[^>]+>/, "").replace(/"/g, "").trim() : senderEmail;

      if (!senderEmail) continue;

      const existing = byEmail.get(senderEmail);
      if (existing) {
        existing.count += 1;
      } else {
        byEmail.set(senderEmail, {
          emailId: msgTyped.id,
          sender: fromRaw,
          senderEmail,
          senderName: senderName || senderEmail,
          subject: get("Subject"),
          date: get("Date"),
          count: 1,
        });
      }
    }

    const candidates = Array.from(byEmail.values())
      .sort((a, b) => b.count - a.count); // most frequent first

    return NextResponse.json({ candidates, scanned: ids.length });
  } catch (err) {
    console.error("Unsubscribe scan error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

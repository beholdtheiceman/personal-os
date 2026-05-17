// GET /api/gmail/message?uid=...&id=... — fetches full email body
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET } from "@/lib/env";

async function refreshToken(uid: string): Promise<string> {
  const db = getAdminDb();
  const doc = await db.doc(`users/${uid}/integrations/gmail`).get();
  if (!doc.exists) throw new Error("Gmail not connected");
  const data = doc.data()!;
  let accessToken: string = data.access_token;
  if (Date.now() > data.expires_at - 60000) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: GOOGLE_CALENDAR_CLIENT_SECRET,
        refresh_token: data.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const refreshed = await res.json();
    if (refreshed.error) throw new Error(refreshed.error_description);
    accessToken = refreshed.access_token;
    await doc.ref.update({ access_token: accessToken, expires_at: Date.now() + 3600 * 1000 });
  }
  return accessToken;
}

function decodePartData(part: Record<string, unknown>): string {
  if (part.body && (part.body as Record<string, unknown>).data) {
    return Buffer.from((part.body as Record<string, string>).data, "base64").toString("utf8");
  }
  return "";
}

function findPart(part: Record<string, unknown>, mime: string): string {
  if ((part.mimeType as string) === mime) {
    const text = decodePartData(part);
    if (text) return text;
  }
  if (part.parts) {
    for (const p of part.parts as Record<string, unknown>[]) {
      const text = findPart(p, mime);
      if (text) return text;
    }
  }
  return "";
}

function htmlToReadable(html: string): string {
  return html
    // Remove entire head, style, script blocks
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    // Kill images entirely — no alt text artifacts
    .replace(/<img[^>]*>/gi, "")
    // Convert block-level elements to newlines
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|tr|h[1-6]|li|blockquote|pre|table|thead|tbody|tfoot)[^>]*>/gi, "\n")
    // Strip all remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode HTML entities
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)));
}

function finalClean(text: string): string {
  return text
    // Remove all URLs — they're almost always tracking links
    .replace(/https?:\/\/[^\s\])"<]+/g, "")
    // Remove markdown-style [label](url) — label already kept, url gone above
    .replace(/\[([^\]]{0,80})\]\(\s*\)/g, "$1")
    // Remove bracket pairs that became empty after URL removal: []
    .replace(/\[\s*\]/g, "")
    // [short label] → label (image alt text fallback, marketing callouts)
    .replace(/\[([^\]]{1,60})\]/g, "$1")
    // Remove remaining long bracket blobs
    .replace(/\[[^\]]+\]/g, "")
    // Remove orphaned parens: ()
    .replace(/\(\s*\)/g, "")
    // Collapse whitespace within lines and remove lines that are just noise
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1 && !/^[-_|=*]{1,5}$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const id = req.nextUrl.searchParams.get("id");
  if (!uid || !id) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const accessToken = await refreshToken(uid);
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msg = await res.json();
    if (msg.error) throw new Error(msg.error.message);

    const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
    const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    // Prefer plain text — simpler and avoids complex HTML table/image artifacts
    const plain = findPart(msg.payload, "text/plain");
    const html = findPart(msg.payload, "text/html");

    let body: string;
    if (plain) {
      body = finalClean(plain);
    } else if (html) {
      body = finalClean(htmlToReadable(html));
    } else {
      body = "(no content)";
    }

    return NextResponse.json({
      id: msg.id,
      threadId: msg.threadId,
      messageId: get("Message-ID"),
      subject: get("Subject"),
      from: get("From"),
      to: get("To"),
      date: get("Date"),
      body: body.slice(0, 6000),
    });
  } catch (err) {
    console.error("Gmail message error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

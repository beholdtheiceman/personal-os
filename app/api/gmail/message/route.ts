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

function findPartByMime(part: Record<string, unknown>, mime: string): string {
  if ((part.mimeType as string) === mime) {
    const text = decodePartData(part);
    if (text) return text;
  }
  if (part.parts) {
    for (const p of part.parts as Record<string, unknown>[]) {
      const text = findPartByMime(p, mime);
      if (text) return text;
    }
  }
  return "";
}

function cleanPlainText(text: string): string {
  return text
    // Remove markdown-style links [label](url) → keep label only
    .replace(/\[([^\]]*)\]\(https?:\/\/[^)]+\)/g, "$1")
    // Remove bare URLs
    .replace(/https?:\/\/\S+/g, "")
    // Remove leftover empty brackets
    .replace(/\[\]/g, "")
    // Collapse 3+ blank lines into 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeBody(part: Record<string, unknown>): { text: string; isHtml: boolean } {
  // Prefer HTML so we can strip it ourselves
  const html = findPartByMime(part, "text/html");
  if (html) return { text: html, isHtml: true };

  const plain = findPartByMime(part, "text/plain");
  if (plain) return { text: plain, isHtml: false };

  // Fallback: grab whatever data is on the root part
  const raw = decodePartData(part);
  return { text: raw, isHtml: false };
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

    const { text: rawBody, isHtml } = decodeBody(msg.payload);
    let body: string;
    if (isHtml) {
      body = rawBody
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    } else {
      body = cleanPlainText(rawBody);
    }

    return NextResponse.json({
      id: msg.id,
      subject: get("Subject"),
      from: get("From"),
      to: get("To"),
      date: get("Date"),
      body: body.slice(0, 5000), // cap at 5k chars
    });
  } catch (err) {
    console.error("Gmail message error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

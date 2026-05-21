// Shared Gmail helpers — token refresh + email body extraction
// Used by all /api/gmail/* routes and the email agent
import { getAdminDb } from "@/lib/firebase-admin";
import { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET } from "@/lib/env";

// ─── Token Refresh ────────────────────────────────────────────────────────────

export async function refreshGmailToken(uid: string): Promise<string> {
  const db = getAdminDb();
  const docRef = db.doc(`users/${uid}/integrations/gmail`);
  const snap = await docRef.get();
  if (!snap.exists) throw new Error("Gmail not connected");

  const data = snap.data()!;
  let accessToken: string = data.access_token;

  if (Date.now() > data.expires_at - 60_000) {
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
    if (refreshed.error) throw new Error(refreshed.error_description ?? refreshed.error);
    accessToken = refreshed.access_token;
    await docRef.update({ access_token: accessToken, expires_at: Date.now() + 3_600_000 });
  }

  return accessToken;
}

// ─── Body Extraction ──────────────────────────────────────────────────────────

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

function decodePartData(part: GmailPart): string {
  if (part.body?.data) {
    return Buffer.from(part.body.data, "base64").toString("utf8");
  }
  return "";
}

export function findPart(part: GmailPart, mime: string): string {
  if (part.mimeType === mime) {
    const text = decodePartData(part);
    if (text) return text;
  }
  if (part.parts) {
    for (const p of part.parts) {
      const text = findPart(p, mime);
      if (text) return text;
    }
  }
  return "";
}

export function htmlToReadable(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|tr|h[1-6]|li|blockquote|pre|table|thead|tbody|tfoot)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)));
}

export function finalClean(text: string): string {
  return text
    .replace(/https?:\/\/[^\s\])"<]+/g, "")
    .replace(/\[([^\]]{0,80})\]\(\s*\)/g, "$1")
    .replace(/\[\s*\]/g, "")
    .replace(/\[([^\]]{1,60})\]/g, "$1")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\(\s*\)/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1 && !/^[-_|=*]{1,5}$/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract a cleaned, readable text body from a raw Gmail message object.
 * Prefers plain text; falls back to HTML → readable conversion.
 * Caps at 6000 characters.
 */
export function extractEmailBody(payload: GmailPart): string {
  const plain = findPart(payload, "text/plain");
  const html  = findPart(payload, "text/html");

  let body: string;
  if (plain) {
    body = finalClean(plain);
  } else if (html) {
    body = finalClean(htmlToReadable(html));
  } else {
    body = "(no content)";
  }

  return body.slice(0, 6000);
}

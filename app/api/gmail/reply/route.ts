// POST /api/gmail/reply — send a reply in the same thread
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

export async function POST(req: NextRequest) {
  const { uid, threadId, messageId, to, subject, body } = await req.json();
  if (!uid || !threadId || !to || !body) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const token = await refreshToken(uid);

    // Get sender's Gmail address from profile
    const profileRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const profile = await profileRes.json();
    if (profile.error) throw new Error(profile.error.message);
    const from = profile.emailAddress as string;

    const replySubject = subject?.startsWith("Re:") ? subject : `Re: ${subject ?? ""}`;

    const rawLines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${replySubject}`,
      ...(messageId ? [`In-Reply-To: ${messageId}`, `References: ${messageId}`] : []),
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      "",
      body,
    ];
    const raw = Buffer.from(rawLines.join("\r\n")).toString("base64url");

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw, threadId }),
      }
    );

    const result = await sendRes.json();
    if (result.error) throw new Error(result.error.message);

    return NextResponse.json({ ok: true, id: result.id });
  } catch (err) {
    console.error("Gmail reply error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

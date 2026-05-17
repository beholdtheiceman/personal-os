// POST /api/gmail/action — archive, trash, mark read/unread
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
  const { uid, id, action } = await req.json();
  if (!uid || !id || !action) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const token = await refreshToken(uid);
    const base = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`;
    const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    let url: string;
    let body: string | null = null;

    switch (action) {
      case "archive":
        url = `${base}/modify`;
        body = JSON.stringify({ removeLabelIds: ["INBOX"] });
        break;
      case "trash":
        url = `${base}/trash`;
        break;
      case "mark_read":
        url = `${base}/modify`;
        body = JSON.stringify({ removeLabelIds: ["UNREAD"] });
        break;
      case "mark_unread":
        url = `${base}/modify`;
        body = JSON.stringify({ addLabelIds: ["UNREAD"] });
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const res = await fetch(url, {
      method: "POST",
      headers: auth,
      ...(body ? { body } : {}),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message ?? "Gmail API error");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Gmail action error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

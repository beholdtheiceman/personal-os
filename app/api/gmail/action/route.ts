// POST /api/gmail/action — archive, trash, mark read/unread
import { NextRequest, NextResponse } from "next/server";
import { refreshGmailToken } from "@/lib/gmail-token";

export async function POST(req: NextRequest) {
  const { uid, id, action } = await req.json();
  if (!uid || !id || !action) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const token = await refreshGmailToken(uid);
    const base  = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`;
    const auth  = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    let url: string;
    let body: string | null = null;

    switch (action) {
      case "archive":
        url  = `${base}/modify`;
        body = JSON.stringify({ removeLabelIds: ["INBOX"] });
        break;
      case "trash":
        url = `${base}/trash`;
        break;
      case "mark_read":
        url  = `${base}/modify`;
        body = JSON.stringify({ removeLabelIds: ["UNREAD"] });
        break;
      case "mark_unread":
        url  = `${base}/modify`;
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
    return NextResponse.json({ error: "Gmail action failed" }, { status: 500 });
  }
}

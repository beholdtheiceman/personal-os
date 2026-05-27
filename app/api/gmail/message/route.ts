// GET /api/gmail/message?uid=...&id=... — fetches full email body
import { NextRequest, NextResponse } from "next/server";
import { refreshGmailToken, findPart, htmlToReadable, finalClean } from "@/lib/gmail-token";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const id  = req.nextUrl.searchParams.get("id");
  if (!uid || !id) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const accessToken = await refreshGmailToken(uid);
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msg = await res.json();
    if (msg.error) throw new Error(msg.error.message);

    const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

    const plain = findPart(msg.payload, "text/plain");
    const html  = findPart(msg.payload, "text/html");

    let body: string;
    if (plain) {
      body = finalClean(plain);
    } else if (html) {
      body = finalClean(htmlToReadable(html));
    } else {
      body = "(no content)";
    }

    return NextResponse.json({
      id:        msg.id,
      threadId:  msg.threadId,
      messageId: get("Message-ID"),
      subject:   get("Subject"),
      from:      get("From"),
      to:        get("To"),
      date:      get("Date"),
      body:      body.slice(0, 6000),
    });
  } catch (err) {
    console.error("Gmail message error:", err);
    return NextResponse.json({ error: "Failed to fetch message" }, { status: 500 });
  }
}

// POST /api/gmail/unsubscribe?uid=...  body: { emailId }
// Fires the List-Unsubscribe action for a single email.
import { NextRequest, NextResponse } from "next/server";
import { refreshGmailToken } from "@/lib/gmail-token";

export async function POST(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  const { emailId } = await req.json() as { emailId: string };
  if (!emailId) return NextResponse.json({ error: "Missing emailId" }, { status: 400 });

  try {
    const accessToken = await refreshGmailToken(uid);

    // Fetch the List-Unsubscribe header
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=metadata` +
      `&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post&metadataHeaders=Subject&metadataHeaders=From`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msg = await res.json();
    if (msg.error) return NextResponse.json({ error: msg.error.message }, { status: 400 });

    const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
    const get = (n: string) => headers.find((h: { name: string }) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

    const listUnsub = get("List-Unsubscribe");
    const listUnsubPost = get("List-Unsubscribe-Post");

    if (!listUnsub) {
      return NextResponse.json({ error: "No List-Unsubscribe header found" }, { status: 422 });
    }

    const httpMatch = listUnsub.match(/<(https?:\/\/[^>]+)>/);
    const mailtoMatch = listUnsub.match(/<mailto:([^>]+)>/);

    // 1. One-click POST (RFC 8058)
    if (httpMatch?.[1] && listUnsubPost?.toLowerCase().includes("list-unsubscribe=one-click")) {
      const unsubUrl = httpMatch[1];
      const postRes = await fetch(unsubUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      });
      return NextResponse.json({ method: "one-click-post", status: postRes.status, ok: postRes.ok });
    }

    // 2. GET unsubscribe URL
    if (httpMatch?.[1]) {
      const unsubUrl = httpMatch[1];
      const getRes = await fetch(unsubUrl, { method: "GET", headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
      return NextResponse.json({ method: "http-get", status: getRes.status, ok: getRes.ok, url: unsubUrl });
    }

    // 3. Mailto fallback — send unsubscribe email via Gmail
    if (mailtoMatch?.[1]) {
      const mailtoRaw = mailtoMatch[1];
      const [toAddr, ...rest] = mailtoRaw.split("?");
      const params = new URLSearchParams(rest.join("?"));
      const subj = params.get("subject") ?? "Unsubscribe";
      const body = params.get("body") ?? "Please unsubscribe me from this mailing list.";

      const raw = [`To: ${toAddr}`, `Subject: ${subj}`, `Content-Type: text/plain`, ``, body].join("\r\n");
      const encoded = Buffer.from(raw).toString("base64url");

      const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ raw: encoded }),
      });
      const sendData = await sendRes.json();
      return NextResponse.json({ method: "mailto", ok: sendRes.ok, error: sendData.error?.message });
    }

    return NextResponse.json({ error: "Could not parse unsubscribe method from header", header: listUnsub }, { status: 422 });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

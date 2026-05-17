// GET /api/gmail/auth?uid=... — redirects to Google OAuth for Gmail access
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "OAuth not configured" }, { status: 500 });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${req.nextUrl.origin}/api/gmail/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail",
    access_type: "offline",
    prompt: "consent",
    state: uid,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

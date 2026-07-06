// GET /api/calendar/auth?uid=... — redirects to Google OAuth for Calendar access
import { NextRequest, NextResponse } from "next/server";
import { signState } from "@/lib/oauth-state";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CALENDAR_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const redirectUri = `${req.nextUrl.origin}/api/calendar/callback`;
  const scope = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",  // get refresh_token
    prompt: "consent",        // always show consent to get refresh_token
    state: signState(uid),    // signed uid — callback verifies before storing tokens
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}

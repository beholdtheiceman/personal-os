// GET /api/people/contacts-auth?uid= — OAuth redirect for Google Contacts read access
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "OAuth not configured" }, { status: 500 });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${req.nextUrl.origin}/api/people/contacts-callback`,
    response_type: "code",
    // Full contacts scope (read + write) so the chat agent can create/update/delete
    // contacts via the People API in addition to the one-shot import.
    scope: "https://www.googleapis.com/auth/contacts",
    access_type: "offline",
    prompt: "consent",
    state: uid,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

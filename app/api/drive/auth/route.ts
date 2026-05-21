// GET /api/drive/auth?uid=... — redirects to Google OAuth for Drive read access
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "OAuth not configured" }, { status: 500 });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${req.nextUrl.origin}/api/drive/callback`,
    response_type: "code",
    // drive.readonly = search + read existing files; drive.file = create + edit files this app makes.
    // Both are needed: read for the chat tools (search_drive, read_drive_file), file for uploads
    // (e.g. save shopping list to Drive). drive.file is narrower than full drive — the app can
    // only touch files it created, never the user's other Drive content.
    scope: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state: uid,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

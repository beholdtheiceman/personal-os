// GET /api/drive/callback — stores Drive OAuth tokens in Firestore
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const uid = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code || !uid) {
    return NextResponse.redirect(`${req.nextUrl.origin}/drive?error=oauth_denied`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        redirect_uri: `${req.nextUrl.origin}/api/drive/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description);

    const db = getAdminDb();
    await db.doc(`users/${uid}/integrations/drive`).set({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      connected_at: new Date().toISOString(),
    });

    return NextResponse.redirect(`${req.nextUrl.origin}/drive?connected=true`);
  } catch (err) {
    console.error("Drive OAuth error:", err);
    return NextResponse.redirect(`${req.nextUrl.origin}/drive?error=token_exchange_failed`);
  }
}

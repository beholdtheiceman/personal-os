// GET /api/health/callback — Google redirects here after Health API OAuth consent
import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const uid = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code || !uid) {
    return NextResponse.redirect(`${req.nextUrl.origin}/health?error=oauth_denied`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
        redirect_uri: `${req.nextUrl.origin}/api/health/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description ?? tokens.error);

    const db = getAdminDb();
    await db.doc(`users/${uid}/integrations/google_health`).set({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      connected_at: new Date().toISOString(),
    });

    return NextResponse.redirect(`${req.nextUrl.origin}/health?connected=true`);
  } catch (err) {
    console.error("Health OAuth callback error:", err);
    return NextResponse.redirect(`${req.nextUrl.origin}/health?error=token_exchange_failed`);
  }
}

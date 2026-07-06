// Shared request authentication for API routes.
//
// Verifies the caller's Firebase ID token and returns the uid FROM THE TOKEN.
// Routes must use this uid and ignore any uid supplied in the query string or
// body — trusting a client-supplied uid is an IDOR (any caller could act as any
// user). Mirrors the inline check in app/api/chat/route.ts.
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

type AuthOk = { uid: string; error?: undefined };
type AuthErr = { uid?: undefined; error: NextResponse };

export async function requireAuth(req: NextRequest): Promise<AuthOk | AuthErr> {
  const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!idToken) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const decoded = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
  if (!decoded) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { uid: decoded.uid };
}

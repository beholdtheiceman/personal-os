// POST /api/notifications/register — save FCM token for a user
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const { uid, token } = await req.json();
  if (!uid || !token) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const db = getAdminDb();
    await db.doc(`users/${uid}/settings/notifications`).set(
      { fcm_token: token, enabled: true, updated_at: new Date().toISOString() },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Notification register error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { uid } = await req.json();
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  try {
    const db = getAdminDb();
    await db.doc(`users/${uid}/settings/notifications`).set(
      { fcm_token: null, enabled: false, updated_at: new Date().toISOString() },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

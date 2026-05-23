// POST /api/notifications/register — save FCM token for a user
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const { uid, token } = await req.json();
  if (!uid || !token) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const db = getAdminDb();
    // Persist the token where the senders read it: the fcm_tokens collection.
    // Doc id = last 24 chars of the token so re-registering the same device de-dupes
    // (matches lib/firebase-messaging.ts).
    const tokenId = String(token).slice(-24);
    await db.doc(`users/${uid}/fcm_tokens/${tokenId}`).set({
      token,
      createdAt: new Date().toISOString(),
      userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    });
    // Convenience flag for the UI (the senders don't gate on this).
    await db.doc(`users/${uid}/settings/notifications`).set(
      { enabled: true, updated_at: new Date().toISOString() },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Notification register error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { uid, token } = await req.json();
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  try {
    const db = getAdminDb();
    if (token) {
      // Remove just this device's token.
      await db.doc(`users/${uid}/fcm_tokens/${String(token).slice(-24)}`).delete();
    } else {
      // No token supplied — clear all of this user's registered devices.
      const snap = await db.collection(`users/${uid}/fcm_tokens`).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    await db.doc(`users/${uid}/settings/notifications`).set(
      { enabled: false, updated_at: new Date().toISOString() },
      { merge: true }
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

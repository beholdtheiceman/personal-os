// POST /api/notifications/send — send a push notification to a user
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const { uid, title, body, url } = await req.json();
  if (!uid || !title) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    const db = getAdminDb();
    const snap = await db.doc(`users/${uid}/settings/notifications`).get();
    if (!snap.exists) return NextResponse.json({ error: "No token registered" }, { status: 404 });

    const { fcm_token, enabled } = snap.data()!;
    if (!enabled || !fcm_token) return NextResponse.json({ error: "Notifications disabled" }, { status: 400 });

    await getAdminMessaging().send({
      token: fcm_token,
      notification: { title, body: body ?? "" },
      data: { url: url ?? "/dashboard" },
      webpush: {
        notification: {
          icon: "/icons/icon.svg",
          badge: "/icons/icon.svg",
          requireInteraction: false,
        },
        fcmOptions: { link: url ?? "/dashboard" },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Notification send error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

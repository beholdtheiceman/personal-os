// GET /api/notifications/daily — cron job: send morning briefing notification
// Scheduled via vercel.json: 12:00 UTC daily (~8am EDT)
import { NextResponse } from "next/server";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collectionGroup("notifications").get();

    const sends: Promise<unknown>[] = [];
    for (const doc of snap.docs) {
      const { fcm_token, enabled } = doc.data();
      if (!enabled || !fcm_token) continue;

      sends.push(
        getAdminMessaging().send({
          token: fcm_token,
          notification: {
            title: "Good morning ☀️",
            body: "Your daily briefing is ready. Tap to start your day.",
          },
          data: { url: "/dashboard" },
          webpush: {
            notification: { icon: "/icons/icon.svg", badge: "/icons/icon.svg" },
            fcmOptions: { link: "/dashboard" },
          },
        }).catch((err) => console.error("Send failed for token:", err))
      );
    }

    await Promise.all(sends);
    return NextResponse.json({ ok: true, sent: sends.length });
  } catch (err) {
    console.error("Daily notification cron error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

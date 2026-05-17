// GET /api/notifications/habits — cron job: evening habit reminder
// Scheduled via vercel.json: 01:00 UTC daily (~9pm EDT)
import { NextResponse } from "next/server";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const db = getAdminDb();
    const today = new Date().toISOString().slice(0, 10);

    // Get all users with notifications enabled
    const notifSnap = await db.collectionGroup("notifications").get();

    const sends: Promise<unknown>[] = [];
    for (const notifDoc of notifSnap.docs) {
      const { fcm_token, enabled } = notifDoc.data();
      if (!enabled || !fcm_token) continue;

      // Extract uid from path: users/{uid}/settings/notifications
      const uid = notifDoc.ref.path.split("/")[1];

      // Count habits and how many are done today
      const habitsSnap = await db.collection(`users/${uid}/habits`).get();
      const total = habitsSnap.size;
      if (total === 0) continue;

      const done = habitsSnap.docs.filter((d) =>
        (d.data().completions as string[] ?? []).includes(today)
      ).length;

      if (done >= total) continue; // All habits complete — no nudge needed

      const remaining = total - done;
      sends.push(
        getAdminMessaging().send({
          token: fcm_token,
          notification: {
            title: "Habit check-in 🔁",
            body: `${remaining} habit${remaining > 1 ? "s" : ""} left to complete today. Keep your streak going!`,
          },
          data: { url: "/habits" },
          webpush: {
            notification: { icon: "/icons/icon.svg", badge: "/icons/icon.svg" },
            fcmOptions: { link: "/habits" },
          },
        }).catch((err) => console.error("Habit send failed:", err))
      );
    }

    await Promise.all(sends);
    return NextResponse.json({ ok: true, sent: sends.length });
  } catch (err) {
    console.error("Habits notification cron error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

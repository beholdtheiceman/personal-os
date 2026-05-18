import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminMessaging, getAdminAuth } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";

export async function POST(req: NextRequest) {
  // Allow either cron secret or authenticated user
  const authHeader = req.headers.get("Authorization") ?? "";
  const cronSecret = getEnv("CRON_SECRET");
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const idToken = authHeader.replace("Bearer ", "");
    try {
      await getAdminAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { uid, title, body, tag, data } = await req.json();
  if (!uid || !title) return NextResponse.json({ error: "Missing uid or title" }, { status: 400 });

  const db = getAdminDb();
  const tokensSnap = await db.collection(`users/${uid}/fcm_tokens`).get();
  if (tokensSnap.empty) return NextResponse.json({ sent: 0, reason: "No tokens registered" });

  const tokens: string[] = tokensSnap.docs.map((d) => d.data().token as string);
  const messaging = getAdminMessaging();

  const results = await Promise.allSettled(
    tokens.map((token) =>
      messaging.send({
        token,
        notification: { title, body: body ?? "" },
        webpush: {
          notification: {
            title,
            body: body ?? "",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: tag ?? "default",
          },
          fcmOptions: { link: "/" },
        },
        data: data ?? {},
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ sent, total: tokens.length });
}

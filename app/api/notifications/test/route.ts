// POST /api/notifications/test — send a test push to the signed-in user's own
// devices. Same-origin and in-process, so it exercises the real delivery path
// (tokens + FCM admin) without the cron or any internal HTTP hop. The uid is
// taken from the verified ID token, never the request body.
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/send-push";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const idToken = authHeader.replace("Bearer ", "");

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendPushToUser(uid, {
    title: "🔔 Test notification",
    body: "If you can see this, push notifications are working.",
    tag: "test",
  });

  return NextResponse.json(result);
}

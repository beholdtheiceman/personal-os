import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";
import { sendPushToUser } from "@/lib/send-push";

export async function POST(req: NextRequest) {
  // Allow either cron secret or authenticated user
  const authHeader = req.headers.get("Authorization") ?? "";
  const cronSecret = getEnv("CRON_SECRET");
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  let verifiedUid: string | null = null;
  if (!isCron) {
    const idToken = authHeader.replace("Bearer ", "");
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      verifiedUid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { uid, title, body, tag, data } = await req.json();
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  // Non-cron callers can only push to their own UID — prevents targeting other users
  const targetUid = isCron ? uid : verifiedUid!;
  if (!targetUid) return NextResponse.json({ error: "Missing uid" }, { status: 400 });

  const result = await sendPushToUser(targetUid, { title, body, tag, data });
  return NextResponse.json(result);
}

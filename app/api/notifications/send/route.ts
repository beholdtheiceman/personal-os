import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";
import { sendPushToUser } from "@/lib/send-push";

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

  const result = await sendPushToUser(uid, { title, body, tag, data });
  return NextResponse.json(result);
}

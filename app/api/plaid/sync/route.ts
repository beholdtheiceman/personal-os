import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getEnv } from "@/lib/env";
import { syncUserPlaid } from "@/lib/plaid-sync";

export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getAdminDb();
    const uid = decoded.uid;

    const { recurring_count, transaction_count } = await syncUserPlaid(uid, db);

    return NextResponse.json({
      success: true,
      recurring_count,
      transaction_count,
    });
  } catch (err) {
    console.error("Plaid sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const cronSecret = getEnv("CRON_SECRET");
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    const usersSnap = await db.collection("users").get();
    const results: Record<string, { recurring_count: number; transaction_count: number }> = {};

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      try {
        // Check whether this user has any plaid items before attempting a full sync
        const itemsCheck = await db
          .collection(`users/${uid}/plaid_items`)
          .limit(1)
          .get();
        if (itemsCheck.empty) continue;

        results[uid] = await syncUserPlaid(uid, db);
      } catch (e) {
        console.error(`Plaid cron sync error for user ${uid}:`, e);
      }
    }

    return NextResponse.json({ checked: usersSnap.size, results });
  } catch (err) {
    console.error("Plaid cron error:", err);
    return NextResponse.json({ error: "Cron sync failed" }, { status: 500 });
  }
}

// GET /api/meal-planner/export-shopping-list?weekStart=YYYY-MM-DD
// Streams a .docx of the shopping list for the requested week (local download).
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { buildShoppingListDocx, type ShoppingListDocItem } from "@/lib/shopping-list-docx";

export async function GET(req: NextRequest) {
  try {
    const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const weekStart = req.nextUrl.searchParams.get("weekStart");
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return NextResponse.json({ error: "Missing or invalid weekStart" }, { status: 400 });
    }

    const snap = await getAdminDb().doc(`users/${decoded.uid}/shopping_lists/${weekStart}`).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "No shopping list for that week" }, { status: 404 });
    }

    const items = ((snap.data()?.items ?? []) as ShoppingListDocItem[]);
    const buffer = await buildShoppingListDocx(weekStart, items);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="shopping-list-${weekStart}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export-shopping-list] error:", err);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

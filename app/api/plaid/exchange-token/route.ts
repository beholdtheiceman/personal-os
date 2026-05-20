import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { public_token, institution_name } = await req.json();
    if (!public_token) return NextResponse.json({ error: "Missing public_token" }, { status: 400 });

    const response = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = response.data;

    // Store access token securely in Firestore (server-side only, never exposed to client)
    await getAdminDb().collection(`users/${decoded.uid}/plaid_items`).doc(item_id).set({
      access_token,
      item_id,
      institution_name: institution_name ?? "Unknown",
      connected_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, item_id, institution_name });
  } catch (err) {
    console.error("Plaid token exchange error:", err);
    return NextResponse.json({ error: "Failed to exchange token" }, { status: 500 });
  }
}

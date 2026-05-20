import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { getAdminAuth } from "@/lib/firebase-admin";
import { CountryCode, Products } from "plaid";

export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const decoded = await getAdminAuth().verifyIdToken(idToken).catch(() => null);
    if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: decoded.uid },
      client_name: "Personal OS",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("Plaid link token error:", err);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}

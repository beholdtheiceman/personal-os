// Shared Google Contacts (People API) token refresh helper
// Mirrors lib/drive-token.ts and lib/gmail-token.ts patterns.
import { getAdminDb } from "@/lib/firebase-admin";

export async function refreshContactsToken(uid: string): Promise<string> {
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/integrations/google_contacts`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Google Contacts not connected");

  const data = snap.data()!;
  if (data.expires_at > Date.now() + 60_000) return data.access_token as string;

  if (!data.refresh_token) {
    // Old import-only token; can't refresh — needs reconnect
    throw new Error("Google Contacts needs to be reconnected (no refresh token stored)");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      refresh_token: data.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });

  const tokens = await res.json();
  if (tokens.error) throw new Error(`Contacts token refresh failed: ${tokens.error_description}`);

  await ref.update({
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  });

  return tokens.access_token as string;
}

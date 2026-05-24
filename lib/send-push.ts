// In-process push sender. Cron dispatchers and the /send route both call this
// directly via the Admin SDK — no internal HTTP hop. The previous design had
// each cron fetch() its own /api/notifications/send over VERCEL_URL, which
// Vercel deployment protection silently 401'd, so notifications never sent.
import { getAdminDb, getAdminMessaging } from "./firebase-admin";

export interface PushPayload {
  title: string;
  body?: string;
  tag?: string;
  data?: Record<string, string>;
}

export interface PushResult {
  sent: number;
  total: number;
  reason?: string;
  errors?: string[];
}

// FCM error codes that mean the token is permanently dead — safe to delete.
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export async function sendPushToUser(uid: string, payload: PushPayload): Promise<PushResult> {
  const db = getAdminDb();
  const tokensSnap = await db.collection(`users/${uid}/fcm_tokens`).get();
  if (tokensSnap.empty) return { sent: 0, total: 0, reason: "No tokens registered" };

  const tokenDocs = tokensSnap.docs.map((d) => ({ id: d.id, token: d.data().token as string }));
  const messaging = getAdminMessaging();
  const { title, body = "", tag = "default", data = {} } = payload;

  const results = await Promise.allSettled(
    tokenDocs.map(({ token }) =>
      messaging.send({
        token,
        notification: { title, body },
        webpush: {
          notification: { title, body, icon: "/icons/icon.svg", badge: "/icons/icon.svg", tag },
          fcmOptions: { link: "/" },
        },
        data,
      })
    )
  );

  const errors: string[] = [];
  await Promise.all(
    results.map(async (r, i) => {
      if (r.status === "rejected") {
        const code = (r.reason as { code?: string })?.code ?? "";
        errors.push(code || String(r.reason));
        // Drop dead tokens so they don't pile up and mask real failures.
        if (DEAD_TOKEN_CODES.has(code)) {
          await db.doc(`users/${uid}/fcm_tokens/${tokenDocs[i].id}`).delete().catch(() => {});
        }
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { sent, total: tokenDocs.length, errors: errors.length ? errors : undefined };
}

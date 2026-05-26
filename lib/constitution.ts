/**
 * Personal Constitution — server-side helpers.
 * Reads the user's constitution doc and formats it for injection
 * into the chat system prompt and daily briefing context.
 */

import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Returns the user's Personal Constitution as a formatted string
 * ready to inject into the Claude system prompt, or null if not yet created.
 */
export async function getConstitutionContext(uid: string): Promise<string | null> {
  try {
    const snap = await getAdminDb().doc(`users/${uid}/constitution/main`).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data?.content || !data?.interview_complete) return null;
    return `## My Personal Constitution\n\n${data.content as string}`;
  } catch {
    return null;
  }
}

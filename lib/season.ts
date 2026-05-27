/**
 * Life Season — server-side helpers.
 * Reads the user's current season doc and formats it for injection
 * into the chat system prompt and weekly review context.
 */

import { getAdminDb } from "@/lib/firebase-admin";

/**
 * Returns the user's current Life Season as a formatted string
 * ready to inject into the Claude system prompt, or null if not active.
 */
export async function getSeasonContext(uid: string): Promise<string | null> {
  try {
    const snap = await getAdminDb().doc(`users/${uid}/season/current`).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data?.checkin_complete || data?.status === "closed") return null;

    const startedAt = data.started_at as string;
    const weeksActive = Math.floor(
      (Date.now() - new Date(startedAt).getTime()) / (1000 * 60 * 60 * 24 * 7)
    );
    const durationLabel =
      weeksActive < 1 ? "just started" : `${weeksActive} week${weeksActive !== 1 ? "s" : ""} in`;

    return `## My Current Life Season

**${data.name as string}**
What this season calls for: ${data.intention as string}

${data.claude_framing as string}

Active since: ${startedAt} (${durationLabel})`;
  } catch {
    return null;
  }
}

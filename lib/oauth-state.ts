// Signed OAuth `state` for Google integration flows.
//
// The /*/auth routes redirect to Google with a `state` param that the matching
// /*/callback reads to know which uid to store the returned tokens under. If that
// state is just the raw uid, a forged callback (attacker's auth `code` + victim's
// uid) can plant the attacker's tokens under the victim's account — an OAuth
// login/account-linking CSRF. Signing state with a server secret + timestamp makes
// it unforgeable and short-lived, so only a flow our server actually started for
// that uid can complete.
import { createHmac, timingSafeEqual } from "crypto";
import { getEnv } from "@/lib/env";

// Reuse CRON_SECRET (already set in every real environment) unless a dedicated
// OAUTH_STATE_SECRET is provided. Empty only in an unconfigured local dev env,
// where sign+verify are still self-consistent (functional, just not protective).
function secret(): string {
  return getEnv("OAUTH_STATE_SECRET") || getEnv("CRON_SECRET");
}

const MAX_AGE_MS = 10 * 60 * 1000; // a consent flow should complete within 10 min

export function signState(uid: string): string {
  const payload = `${uid}.${Date.now()}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

// Returns the uid iff `state` is a valid, non-expired signature; otherwise null.
// Firebase uids contain no ".", so splitting on "." is unambiguous.
export function verifyState(state: string | null | undefined): string | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [uid, ts, sig] = parts;
  const expected = createHmac("sha256", secret()).update(`${uid}.${ts}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;
  return uid;
}

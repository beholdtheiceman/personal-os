// Admin-SDK timezone helpers — used by cron route handlers.
// All functions read from users/{uid}/settings/timezone which is written
// client-side on every app load (see AuthContext).

import { getAdminDb } from "./firebase-admin";

const FALLBACK_TZ = "America/New_York";

async function loadTz(uid: string, useCurrentTz: boolean): Promise<string> {
  const snap = await getAdminDb().doc(`users/${uid}/settings/timezone`).get();
  const d = snap.data();
  if (!d) return FALLBACK_TZ;
  return useCurrentTz
    ? (d.current_timezone ?? d.home_timezone ?? FALLBACK_TZ)
    : (d.home_timezone ?? FALLBACK_TZ);
}

export interface LocalTimeInfo {
  tz: string;
  localHour: number;
  localMinute: number;
  localDayOfWeek: number; // 0 = Sun
  localDate: string;      // YYYY-MM-DD
}

// One Firestore read per user — call this once per user loop and pass result to
// isHour() / isDay() below to avoid repeated reads.
export async function getLocalTimeInfo(uid: string, useCurrentTz = true): Promise<LocalTimeInfo> {
  const tz = await loadTz(uid, useCurrentTz);
  const now = new Date();

  const timeStr = now.toLocaleTimeString("en-US", {
    timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit",
  });
  const [localHour, localMinute] = timeStr.split(":").map(Number);
  const localDayOfWeek = new Date(now.toLocaleString("en-US", { timeZone: tz })).getDay();
  const localDate = now.toLocaleDateString("en-CA", { timeZone: tz });

  return { tz, localHour, localMinute, localDayOfWeek, localDate };
}

// Checks whether localHour matches the hour portion of a "HH:mm" string.
// Crons fire at :00 of each hour, so hour-level precision is sufficient.
export function isHour(info: LocalTimeInfo, preferredTime: string): boolean {
  const [prefHour] = preferredTime.split(":").map(Number);
  return info.localHour === prefHour;
}

// One-shot convenience wrapper when you only need a single time check.
export async function isLocalTime(uid: string, preferredTime: string, useCurrentTz = true): Promise<boolean> {
  const info = await getLocalTimeInfo(uid, useCurrentTz);
  return isHour(info, preferredTime);
}

// Returns YYYY-MM-DD in the user's local timezone.
export async function getUserLocalDate(uid: string, useCurrentTz = true): Promise<string> {
  const info = await getLocalTimeInfo(uid, useCurrentTz);
  return info.localDate;
}

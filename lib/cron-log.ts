// Lightweight, durable record of cron executions.
//
// Vercel's runtime Logs UI only retains a short recent window, so there's no
// way to tell after the fact whether a nightly cron actually fired. This writes
// a Firestore record on every run:
//   cron_runs/{job}            — latest run (last_run_at, last_status, detail)
//   cron_runs/{job}/runs/{ts}  — one doc per run, for a rolling history
//
// Best-effort: never throws, so a logging failure can't break the cron itself.
import { getAdminDb } from "@/lib/firebase-admin";

export type CronStatus = "ok" | "error";

export async function recordCronRun(
  job: string,
  status: CronStatus,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    const db = getAdminDb();
    const now = new Date().toISOString();
    await db.doc(`cron_runs/${job}`).set(
      { job, last_run_at: now, last_status: status, last_detail: detail },
      { merge: true },
    );
    await db.doc(`cron_runs/${job}/runs/${now}`).set({ at: now, status, ...detail });
  } catch (err) {
    // Logging is non-critical — surface to Vercel logs but don't fail the cron.
    console.error(`recordCronRun(${job}) failed:`, err);
  }
}

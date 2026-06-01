// Recurring task date math. Pure functions — safe on both the client
// (firebase web SDK) and server (firebase-admin) sides.
import { addDays, addWeeks, addMonths, addYears, format, parseISO } from "date-fns";
import type { RecurrenceCadence, BillingCycle, ReminderRecurrence } from "@/types";

// Next occurrence date (YYYY-MM-DD) for a given cadence.
export function nextDueDate(cadence: RecurrenceCadence, from: string): string {
  const base = parseISO(from);
  const next =
    cadence === "daily"  ? addDays(base, 1) :
    cadence === "weekly" ? addWeeks(base, 1) :
                           addMonths(base, 1);
  return format(next, "yyyy-MM-dd");
}

// Recur from the task's own due date when it has one, otherwise from the
// completion date (today) — mirrors how most task apps handle "no due date".
export function computeNextDue(
  cadence: RecurrenceCadence,
  currentDue: string | null,
  today: string
): string {
  return nextDueDate(cadence, currentDue ?? today);
}

// Whether the next occurrence still falls on/before the optional end date.
// Lexicographic comparison is correct for zero-padded YYYY-MM-DD strings.
export function isWithinRecurrence(nextDue: string, end?: string | null): boolean {
  if (!end) return true;
  return nextDue <= end;
}

// ─── Recurring reminders ────────────────────────────────────────────────────
// Whether a given day-of-week (0=Sun) is a valid fire day for the cadence.
function isReminderFireDay(recurrence: ReminderRecurrence, dayOfWeek: number): boolean {
  if (recurrence === "weekdays") return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (recurrence === "weekends") return dayOfWeek === 0 || dayOfWeek === 6;
  return true; // daily, weekly fire every eligible day
}

// Advance the date by one step of the cadence, landing on a valid fire day.
function advanceReminderDate(recurrence: ReminderRecurrence, base: Date): Date {
  let next = recurrence === "weekly" ? addWeeks(base, 1) : addDays(base, 1);
  // weekdays/weekends may need to skip ahead to the next eligible day
  while (!isReminderFireDay(recurrence, next.getDay())) {
    next = addDays(next, 1);
  }
  return next;
}

// Advance a recurring reminder's local datetime ("YYYY-MM-DDTHH:MM") to the next
// occurrence strictly after `after` (same format). The time-of-day is preserved;
// only the calendar date moves. Past missed runs are collapsed into a single jump
// to the next future slot — a snoozed laptop never replays a week of pings at once.
export function nextReminderFireAt(
  recurrence: ReminderRecurrence,
  fireAt: string,
  after: string
): string {
  const [datePart, timePart] = fireAt.split("T");
  let d = parseISO(datePart);
  let candidate = fireAt;
  // Guard against pathological loops (e.g. malformed input). 4000 daily steps
  // is ~11 years — far beyond any legitimate catch-up window.
  for (let i = 0; candidate <= after && i < 4000; i++) {
    d = advanceReminderDate(recurrence, d);
    candidate = `${format(d, "yyyy-MM-dd")}T${timePart}`;
  }
  return candidate;
}

/** Advance a subscription billing date by exactly one cycle. */
export function nextSubscriptionDate(cycle: BillingCycle, from: string): string {
  const base = parseISO(from);
  switch (cycle) {
    case 'weekly':    return format(addWeeks(base, 1), 'yyyy-MM-dd');
    case 'monthly':   return format(addMonths(base, 1), 'yyyy-MM-dd');
    case 'quarterly': return format(addMonths(base, 3), 'yyyy-MM-dd');
    case 'yearly':    return format(addYears(base, 1), 'yyyy-MM-dd');
  }
}

/** Advance a past billing date forward until it's in the future. */
export function advancedBillingDate(cycle: BillingCycle, date: string): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  let d = date;
  while (d < today) {
    d = nextSubscriptionDate(cycle, d);
  }
  return d;
}

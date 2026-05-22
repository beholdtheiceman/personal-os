// Recurring task date math. Pure functions — safe on both the client
// (firebase web SDK) and server (firebase-admin) sides.
import { addDays, addWeeks, addMonths, format, parseISO } from "date-fns";
import type { RecurrenceCadence } from "@/types";

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

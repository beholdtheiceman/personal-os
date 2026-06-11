import type { Person } from "@/types";

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

export function computeHealthScore(person: Person): number | null {
  if (!person.contact_frequency || !person.last_contacted) return null;
  const threshold = FREQUENCY_DAYS[person.contact_frequency];
  if (!threshold) return null;
  const daysSince = Math.floor(
    (Date.now() - new Date(person.last_contacted + "T12:00:00Z").getTime()) / 86400000
  );
  return Math.max(0, Math.round(100 * (1 - daysSince / (threshold * 2))));
}

export function scoreLabel(score: number | null): string {
  if (score === null) return "Unknown";
  if (score >= 80) return "Healthy";
  if (score >= 50) return "OK";
  if (score >= 25) return "At risk";
  return "Neglected";
}

export function scoreColor(score: number | null): string {
  if (score === null) return "text-text-muted";
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-amber-400";
  if (score >= 25) return "text-orange-400";
  return "text-danger";
}

export function scoreBg(score: number | null): string {
  if (score === null) return "bg-white/10";
  if (score >= 80) return "bg-success/15";
  if (score >= 50) return "bg-amber-400/15";
  if (score >= 25) return "bg-orange-400/15";
  return "bg-danger/15";
}

/**
 * Quarterly System Audit — analyzes 90 days of engagement across every tracker
 * and surfaces what's active vs. what's become noise.
 * Stored at users/{uid}/system_audit/latest.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";

interface AuditTracker {
  name: string;
  collection: string;
  dateField: string;
  label: string;
}

const TRACKERS: AuditTracker[] = [
  { name: "tasks",        collection: "tasks",         dateField: "created_at",   label: "Task Manager" },
  { name: "habits",       collection: "habits",        dateField: "_completions", label: "Habit Tracker" },
  { name: "journal",      collection: "journal",       dateField: "created_at",   label: "Journal" },
  { name: "health",       collection: "health",        dateField: "date",         label: "Health Log" },
  { name: "nutrition",    collection: "nutrition",     dateField: "logged_at",    label: "Nutrition" },
  { name: "workouts",     collection: "workouts",      dateField: "date",         label: "Workouts" },
  { name: "time",         collection: "time_entries",  dateField: "start_time",   label: "Time Tracker" },
  { name: "goals",        collection: "goals",         dateField: "created_at",   label: "Goals" },
  { name: "transactions", collection: "transactions",  dateField: "date",         label: "Finance" },
  { name: "people",       collection: "people",        dateField: "last_contact", label: "People CRM" },
  { name: "reading",      collection: "reading_list",  dateField: "updated_at",   label: "Reading List" },
  { name: "content",      collection: "content_items", dateField: "updated_at",   label: "Content Tracker" },
  { name: "decisions",    collection: "decisions",     dateField: "created_at",   label: "Decision Journal" },
  { name: "mood",         collection: "mood_logs",     dateField: "date",         label: "Mood Tracker" },
  { name: "memory",       collection: "memory",        dateField: "created_at",   label: "Memory / Second Brain" },
];

export interface EngagementResult {
  label: string;
  entries90d: number;
  lastActive: string | null;
  status: "active" | "light" | "dormant";
}

export interface SystemAuditDoc {
  content: string;
  engagement: EngagementResult[];
  generated_at: string;
  date: string;
}

async function measureEngagement(uid: string): Promise<EngagementResult[]> {
  const db = getAdminDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const results: EngagementResult[] = [];

  for (const tracker of TRACKERS) {
    try {
      // Habits: completions are stored as an array inside each habit doc
      if (tracker.name === "habits") {
        const snap = await db.collection(`users/${uid}/habits`).get();
        let count = 0;
        let latest: string | null = null;
        for (const d of snap.docs) {
          const completions: string[] = d.data().completions ?? [];
          const recent = completions.filter((c) => c >= cutoffStr);
          count += recent.length;
          const last = [...completions].sort().reverse()[0] ?? null;
          if (last && (!latest || last > latest)) latest = last;
        }
        results.push({
          label: tracker.label, entries90d: count, lastActive: latest,
          status: count >= 20 ? "active" : count >= 5 ? "light" : "dormant",
        });
        continue;
      }

      let count = 0;
      let lastActive: string | null = null;
      try {
        const snap = await db.collection(`users/${uid}/${tracker.collection}`)
          .orderBy(tracker.dateField, "desc").limit(200).get();
        for (const d of snap.docs) {
          const raw = d.data()[tracker.dateField] as string | undefined;
          if (!raw) continue;
          const dateStr = raw.slice(0, 10);
          if (dateStr >= cutoffStr) {
            count++;
            if (!lastActive || dateStr > lastActive) lastActive = dateStr;
          }
        }
      } catch { /* collection may not exist or field not indexed */ }

      results.push({
        label: tracker.label, entries90d: count, lastActive,
        status: count >= 10 ? "active" : count >= 3 ? "light" : "dormant",
      });
    } catch {
      results.push({ label: tracker.label, entries90d: 0, lastActive: null, status: "dormant" });
    }
  }
  return results;
}

export async function generateSystemAudit(uid: string): Promise<SystemAuditDoc> {
  const today = new Date().toISOString().slice(0, 10);
  const engagement = await measureEngagement(uid);

  const activeList  = engagement.filter((e) => e.status === "active");
  const lightList   = engagement.filter((e) => e.status === "light");
  const dormantList = engagement.filter((e) => e.status === "dormant");

  const summaryLines = engagement.map((e) =>
    `- ${e.label}: ${e.entries90d} entries in 90 days, last active ${e.lastActive ?? "never"} [${e.status.toUpperCase()}]`
  ).join("\n");

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: [
      "You are conducting a quarterly system audit for a personal life OS.",
      "Analyze engagement data and surface honest, direct observations. Be brief and useful.",
      "Format your response with exactly three markdown sections:",
      "## What's Working",
      "## What's Gone Quiet",
      "## One Recommendation",
      "Keep each section to 2-4 bullet points. Total under 250 words. No filler.",
    ].join("\n"),
    messages: [{
      role: "user",
      content: [
        `Audit date: ${today}`,
        `\nEngagement data (last 90 days):\n${summaryLines}`,
        `\nActive: ${activeList.map((e) => e.label).join(", ") || "none"}`,
        `Light usage: ${lightList.map((e) => e.label).join(", ") || "none"}`,
        `Dormant: ${dormantList.map((e) => e.label).join(", ") || "none"}`,
        `\nProvide a concise, honest quarterly system audit.`,
      ].join("\n"),
    }],
  });

  const content = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  const doc: SystemAuditDoc = {
    content, engagement,
    generated_at: new Date().toISOString(),
    date: today,
  };

  await getAdminDb().doc(`users/${uid}/system_audit/latest`).set(doc);
  return doc;
}

export async function getSystemAudit(uid: string): Promise<SystemAuditDoc | null> {
  try {
    const snap = await getAdminDb().doc(`users/${uid}/system_audit/latest`).get();
    if (!snap.exists) return null;
    return snap.data() as SystemAuditDoc;
  } catch {
    return null;
  }
}

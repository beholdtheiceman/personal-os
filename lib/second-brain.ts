import fs from "fs";
import path from "path";
import { getAdminDb } from "./firebase-admin";

const SECOND_BRAIN_PATH = process.env.SECOND_BRAIN_PATH || "C:\\Users\\Larry\\Documents\\SecondBrain";
const IS_AVAILABLE = (() => { try { return fs.existsSync(SECOND_BRAIN_PATH); } catch { return false; } })();

export function getSecondBrainPath(...parts: string[]) {
  return path.join(SECOND_BRAIN_PATH, ...parts);
}

export function readFile(relativePath: string): string {
  try {
    return fs.readFileSync(getSecondBrainPath(relativePath), "utf8");
  } catch {
    return "";
  }
}

export function writeFile(relativePath: string, content: string) {
  const fullPath = getSecondBrainPath(relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

export function appendToFile(relativePath: string, content: string) {
  const fullPath = getSecondBrainPath(relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.appendFileSync(fullPath, content, "utf8");
}

// Read the master CLAUDE.md for system prompt injection
export function getSecondBrainContext(): string {
  if (!IS_AVAILABLE) return "";
  const master = readFile("CLAUDE.md");
  const tasks = readFile("TASKS.md");
  if (!master) return "";
  return `## Second Brain Context\n${master}\n\n## Current Tasks (TASKS.md)\n${tasks}`;
}

export function isSecondBrainAvailable() { return IS_AVAILABLE; }

// Search all markdown files for a query, returns matching excerpts
export function searchSecondBrain(query: string, maxResults = 5): { file: string; excerpt: string }[] {
  const results: { file: string; excerpt: string; score: number }[] = [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".md")) {
        try {
          const content = fs.readFileSync(fullPath, "utf8");
          const lower = content.toLowerCase();
          const score = terms.reduce((s, t) => s + (lower.split(t).length - 1), 0);
          if (score > 0) {
            // Find the first matching paragraph as excerpt
            const lines = content.split("\n");
            const matchLine = lines.findIndex((l) => terms.some((t) => l.toLowerCase().includes(t)));
            const start = Math.max(0, matchLine - 1);
            const excerpt = lines.slice(start, start + 6).join("\n").trim();
            const relPath = path.relative(SECOND_BRAIN_PATH, fullPath);
            results.push({ file: relPath, excerpt, score });
          }
        } catch { /* skip */ }
      }
    }
  }

  walk(SECOND_BRAIN_PATH);
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ file, excerpt }) => ({ file, excerpt }));
}

// ── Firestore-based functions (used in production / Vercel) ──────────────────

export async function getSecondBrainContextFromDB(uid: string): Promise<string> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(`users/${uid}/second_brain`).get();
    if (snap.empty) return "";

    const docs = snap.docs.map((d) => d.data() as { path: string; content: string });

    // Always include root CLAUDE.md and TASKS.md
    const priority = ["CLAUDE.md", "TASKS.md", "WORKFLOW.md"];
    const priorityDocs = priority
      .map((name) => docs.find((d) => d.path === name))
      .filter(Boolean) as { path: string; content: string }[];

    const otherDocs = docs.filter((d) => !priority.includes(d.path));

    const parts: string[] = ["## Second Brain Context\n"];
    for (const doc of priorityDocs) {
      parts.push(`### ${doc.path}\n${doc.content}`);
    }
    // Include remaining docs up to ~8000 chars total to stay within context budget
    let remaining = 8000 - parts.join("\n").length;
    for (const doc of otherDocs) {
      if (remaining <= 0) break;
      const entry = `### ${doc.path}\n${doc.content}`;
      parts.push(entry);
      remaining -= entry.length;
    }

    return parts.join("\n\n");
  } catch {
    return "";
  }
}

export async function searchSecondBrainFromDB(
  uid: string,
  query: string,
  maxResults = 5
): Promise<{ file: string; excerpt: string }[]> {
  try {
    const db = getAdminDb();
    const snap = await db.collection(`users/${uid}/second_brain`).get();
    if (snap.empty) return [];

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results: { file: string; excerpt: string; score: number }[] = [];

    for (const d of snap.docs) {
      const { path: filePath, content } = d.data() as { path: string; content: string };
      const lower = content.toLowerCase();
      const score = terms.reduce((s, t) => s + (lower.split(t).length - 1), 0);
      if (score > 0) {
        const lines = content.split("\n");
        const matchLine = lines.findIndex((l) => terms.some((t) => l.toLowerCase().includes(t)));
        const start = Math.max(0, matchLine - 1);
        const excerpt = lines.slice(start, start + 6).join("\n").trim();
        results.push({ file: filePath, excerpt, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ file, excerpt }) => ({ file, excerpt }));
  } catch {
    return [];
  }
}

export async function captureToInboxDB(uid: string, text: string, destination: "inbox" | "tasks" = "inbox") {
  const db = getAdminDb();
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  const snap = await db.collection(`users/${uid}/second_brain`).where("path", "==",
    destination === "tasks" ? "TASKS.md" : "Inbox/captures.md"
  ).limit(1).get();

  const logEntry = destination === "tasks"
    ? `\n- [ ] ${text}  <!-- captured ${timestamp} -->`
    : `\n---\n**${timestamp}**\n${text}\n`;

  if (!snap.empty) {
    const docRef = snap.docs[0].ref;
    const existing = (snap.docs[0].data().content as string) ?? "";
    await docRef.update({ content: existing + logEntry, syncedAt: new Date().toISOString() });
  } else {
    await db.collection(`users/${uid}/second_brain`).add({
      path: destination === "tasks" ? "TASKS.md" : "Inbox/captures.md",
      filename: destination === "tasks" ? "TASKS.md" : "captures.md",
      content: logEntry,
      syncedAt: new Date().toISOString(),
    });
  }
  return destination === "tasks" ? "TASKS.md" : "Inbox/captures.md";
}

// ── Local filesystem functions (used in dev / Claude Code) ───────────────────

// Append a timestamped capture to the inbox log
export function captureToInbox(text: string, destination: "inbox" | "tasks" = "inbox") {
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 16);

  if (destination === "tasks") {
    appendToFile("TASKS.md", `\n- [ ] ${text}  <!-- captured ${timestamp} -->`);
    return "TASKS.md";
  }

  const logEntry = `\n---\n**${timestamp}**\n${text}\n`;
  appendToFile("Inbox/captures.md", logEntry);
  appendToFile("Inbox/capture-log.md", `${timestamp} | ${text.slice(0, 80)}\n`);
  return "Inbox/captures.md";
}

import fs from "fs";
import path from "path";

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

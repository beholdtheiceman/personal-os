import fs from "fs";
import path from "path";

// Turbopack (Next.js 15 dev) has a bug where non-NEXT_PUBLIC_ env vars
// are not reliably injected into process.env for API routes.
// This utility reads .env.local directly as a fallback.
function readEnvLocal(): Record<string, string> {
  try {
    const file = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const result: Record<string, string> = {};
    for (const line of file.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
    return result;
  } catch {
    return {};
  }
}

const _env = readEnvLocal();

export function getEnv(key: string): string {
  return process.env[key] || _env[key] || "";
}

export const ANTHROPIC_API_KEY = getEnv("ANTHROPIC_API_KEY");
export const GOOGLE_CALENDAR_CLIENT_ID = getEnv("GOOGLE_CALENDAR_CLIENT_ID");
export const GOOGLE_CALENDAR_CLIENT_SECRET = getEnv("GOOGLE_CALENDAR_CLIENT_SECRET");
export const TAVILY_API_KEY = getEnv("TAVILY_API_KEY");
export const CRON_SECRET = getEnv("CRON_SECRET");
export const PLAID_CLIENT_ID = getEnv("PLAID_CLIENT_ID");
export const PLAID_SECRET = getEnv("PLAID_SECRET");
export const PLAID_ENV = getEnv("PLAID_ENV") || "sandbox";

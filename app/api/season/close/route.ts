import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";
import type { SeasonMessage } from "@/types";

export const maxDuration = 60;

function buildCloseSystem(seasonName: string, startedAt: string): string {
  return `You are helping someone close out a life season called "${seasonName}" which began ${startedAt}. This is a brief, meaningful ritual — not a long reflection.

THE PROCESS (2-3 turns):
Turn 1: Ask exactly: "Before we close ${seasonName}, let's take a moment. What did this season produce — not just what you accomplished, but what it gave you or asked of you?"
Turn 2: Reflect briefly (1 sentence), then ask: "What do you want to carry forward from it? And what does the next season seem to be calling for — even if you can't name it yet?"
Turn 3 (if needed): Confirm briefly.

OUTPUT SIGNAL when ready:
CLOSE_READY
reflection: [2-3 sentences synthesizing what this season was and what it gave them — written to be worth keeping]

RULES:
- Keep it short and meaningful, not therapeutic
- Honor what the season was without forcing positivity
- If it was hard, say it was hard
- After CLOSE_READY output nothing else`;
}

function parseReflection(text: string): string {
  const idx = text.indexOf("reflection:");
  if (idx === -1) return "";
  return text.slice(idx + "reflection:".length).trim();
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      await getAdminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, seasonName, startedAt } = (await req.json()) as {
      messages: SeasonMessage[];
      seasonName: string;
      startedAt: string;
    };

    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role === "guide" ? "assistant" : "user",
      content: m.content,
    }));

    const apiMessages: Anthropic.MessageParam[] =
      anthropicMessages.length === 0
        ? [{ role: "user", content: "Let's begin." }]
        : anthropicMessages;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: buildCloseSystem(seasonName, startedAt),
      messages: apiMessages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    if (text.includes("CLOSE_READY")) {
      const reflection = parseReflection(text);
      return NextResponse.json({ type: "complete", content: text, reflection });
    }

    return NextResponse.json({ type: "question", content: text });
  } catch (err) {
    console.error("[/api/season/close]", err);
    return NextResponse.json({ error: "Close ritual failed" }, { status: 500 });
  }
}

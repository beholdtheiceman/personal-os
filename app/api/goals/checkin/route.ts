// POST /api/goals/checkin — Claude gives a motivating check-in for a goal
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const { title, description, milestones, target_date } = await req.json();

    const completed = milestones?.filter((m: { completed: boolean }) => m.completed).length ?? 0;
    const total = milestones?.length ?? 0;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Give a brief, motivating check-in for this goal. Be direct and specific.

Goal: ${title}
Description: ${description || "none"}
Progress: ${completed}/${total} milestones completed
Target date: ${target_date || "not set"}

Reply in 2-3 sentences. Acknowledge progress, give one concrete next action. No fluff.`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ message: text });
  } catch (err) {
    console.error("Goal check-in error:", err);
    return NextResponse.json({ error: "Failed to get check-in" }, { status: 500 });
  }
}

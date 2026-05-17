// POST /api/daily-report — generates or fetches today's AI morning briefing
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const { systemPrompt, userName } = await req.json();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Generate my daily morning briefing. Include:
1. A short personalized greeting (1–2 sentences, reference something from my context)
2. My top 3 priorities for today with brief reasoning
3. Any important calendar notes or conflicts
4. One insight or suggestion based on my goals/memory

Keep it under 200 words. Be direct and motivating. Use markdown formatting.`,
        },
      ],
    });

    const report =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ report });
  } catch (err) {
    console.error("Daily report error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

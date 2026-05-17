// POST /api/journal/summarize — Claude summarizes a journal entry and extracts mood + tags
import { NextRequest, NextResponse } from "next/server";
import { ANTHROPIC_API_KEY } from "@/lib/env";

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `Analyze this journal entry and respond with ONLY valid JSON (no markdown, no explanation):

"${text}"

Return exactly this structure:
{
  "summary": "2-3 sentence summary capturing the key themes and emotional tone",
  "mood_score": <integer 1-10 where 1=very negative, 5=neutral, 10=very positive>,
  "tags": ["tag1", "tag2"]
}`,
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Anthropic API error:", JSON.stringify(data));
      return NextResponse.json({ error: data.error?.message ?? "API error" }, { status: 500 });
    }

    const raw = stripFences(data.content[0].text);
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Journal summarize error:", err);
    return NextResponse.json({ error: "Failed to analyze entry" }, { status: 500 });
  }
}

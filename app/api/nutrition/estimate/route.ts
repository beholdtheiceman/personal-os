// POST /api/nutrition/estimate — Claude estimates macros from a meal description
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const { description, meal } = await req.json();
    if (!description?.trim()) {
      return NextResponse.json({ error: "Missing description" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Estimate the nutritional content for this ${meal || "meal"}: "${description}"

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "calories_estimated": <integer>,
  "protein_g": <integer>,
  "carbs_g": <integer>,
  "fat_g": <integer>
}

Use reasonable average estimates for typical portion sizes.`,
        },
      ],
    });

    const raw = stripFences((message.content[0] as { text: string }).text);
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Nutrition estimate error:", err);
    return NextResponse.json({ error: "Failed to estimate nutrition" }, { status: 500 });
  }
}

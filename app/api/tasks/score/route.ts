// POST /api/tasks/score — uses Claude to assign a priority score 1-100 to a task
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const { title, description, tags, due_date } = await req.json();

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Score this task from 1–100 based on urgency, impact, and effort.
Higher score = do it sooner. Return ONLY a JSON object, no explanation.

Task:
- Title: ${title}
- Description: ${description || "none"}
- Tags: ${tags?.join(", ") || "personal"}
- Due date: ${due_date || "no due date"}

Today's date: ${new Date().toDateString()}

Return: {"score": <number 1-100>, "reasoning": "<one sentence>"}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 50, reasoning: "Default score" };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Score error:", err);
    return NextResponse.json({ score: 50, reasoning: "Could not score" });
  }
}

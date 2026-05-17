// POST /api/tasks/extract — uses Claude to extract structured tasks from free-form text
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const { input } = await req.json();

    if (!input?.trim()) {
      return NextResponse.json({ tasks: [] });
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001", // Use fast/cheap model for extraction
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Extract all tasks from the following input and return ONLY a valid JSON array.

Each task object must have:
- "title": short task name (string)
- "description": more detail if mentioned, otherwise empty string
- "priority_score": number 1–100 (higher = more urgent/important)
- "tags": array containing one or more of ["personal", "business", "health", "finance"]

Return ONLY the JSON array, no explanation, no markdown fences.

Input: ${input}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";

    // Safely parse — Claude might add a tiny bit of extra text
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const tasks = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("Task extract error:", err);
    // Fall back to a single task using the raw input
    return NextResponse.json({
      tasks: [{ title: "New task", description: "", priority_score: 50, tags: ["personal"] }],
    });
  }
}

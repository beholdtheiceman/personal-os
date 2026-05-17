// POST /api/memory/suggest — Claude suggests new memory items based on recent journal/chat
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const { recentContent, existingMemory } = await req.json();

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Based on the user's recent activity, suggest new memory entries that would help a personal AI assistant.

EXISTING MEMORY:
${existingMemory}

RECENT CONTENT (journal entries / chat history):
${recentContent}

Return a JSON array of suggested memory entries. Each object must have:
- "category": one of ["Identity", "AI Interaction Style", "Personal Preferences", "Business & Work", "Health Baselines", "Financial Snapshot", "Current Priorities"]
- "key": short label
- "value": the value to remember

Return ONLY the JSON array, no explanation.`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Memory suggest error:", err);
    return NextResponse.json({ suggestions: [] });
  }
}

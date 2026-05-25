# Transcript Ingestion — Implementation Guide

## Overview

A dedicated endpoint that accepts a block of text (a doctor visit debrief, post-workout summary, financial conversation, etc.) and uses Claude to extract structured data and automatically file it into the right places in the app. This is the fastest path to the "ambient capture" vision — no Realtime API needed, works with any text source.

**Estimated effort:** 1–2 days  
**Dependencies:** Existing `/api/chat` tool infrastructure (already built)

---

## How It Works

1. User speaks or types a debrief in a "Capture" modal
2. Request hits `POST /api/ingest/transcript`
3. Claude reads the transcript with a context-aware system prompt
4. Claude fires the appropriate existing tools (log_health, add_task, log_interaction, etc.)
5. Endpoint returns a summary of what was captured

---

## New Endpoint

### `app/api/ingest/transcript/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { ANTHROPIC_API_KEY } from "@/lib/env";

// Import your existing tool definitions from /api/chat/route.ts
// Recommended: extract tools array into lib/chat-tools.ts so both routes share it
import { ALL_TOOLS } from "@/lib/chat-tools";

const CONTEXT_PROMPTS: Record<string, string> = {
  doctor_visit: `You are processing notes from a doctor's appointment. Extract and log:
- Health observations (symptoms, diagnoses, vitals) → log_health or add_journal_entry
- New medications or supplements → add_supplement
- Follow-up tasks (schedule next appointment, pick up prescription) → add_task with due dates
- Any decisions made → add_decision
Be thorough. If a follow-up is mentioned without a specific date, create the task anyway with a note.`,

  workout_debrief: `You are processing a post-workout debrief. Extract and log:
- Exercises, sets, reps, weights → log_workout
- How the session felt (energy, pain, PRs) → add_journal_entry or log_health notes
- Any goals mentioned → update_goal if it matches an existing one
Focus on capturing the workout data accurately.`,

  financial_conversation: `You are processing notes from a financial conversation. Extract and log:
- Any transactions or purchases mentioned → add_transaction
- Budget decisions → set_budget
- Savings targets discussed → add_savings_goal or log_savings_contribution
- Action items (call the bank, review statements) → add_task
- Key decisions made → add_decision`,

  relationship_debrief: `You are processing notes from a social interaction. Extract and log:
- Log the interaction itself → log_interaction (with person name, type, notes)
- Any follow-ups promised → add_task
- New information about the person (birthday, job change, interests) → update_person
- Gift ideas mentioned → update_person with gift_ideas`,

  general_debrief: `You are a personal life assistant processing a voice or text debrief. 
Extract anything actionable or worth remembering and log it to the right place:
- Tasks and to-dos → add_task
- Health information → log_health
- Mood → log_mood
- Ideas → capture_to_second_brain
- Things to remember about people → log_interaction or update_person
- Journal-worthy reflections → add_journal_entry
Use your judgment. When in doubt, capture_to_second_brain.`,
};

export async function POST(req: NextRequest) {
  // Auth
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { transcript, context = "general_debrief" } = await req.json();
  if (!transcript?.trim()) {
    return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
  }

  const systemPrompt = CONTEXT_PROMPTS[context] ?? CONTEXT_PROMPTS.general_debrief;
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const captured: string[] = [];

  // Agentic loop — let Claude fire tools until it's done
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Here is the transcript to process:\n\n---\n${transcript}\n---\n\nExtract and log everything relevant. After you're done, give me a brief summary of what was captured.`,
    },
  ];

  let response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    tools: ALL_TOOLS,
    messages,
  });

  // Tool use loop (same pattern as /api/chat)
  while (response.stop_reason === "tool_use") {
    const toolUses = response.content.filter(b => b.type === "tool_use");
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      if (toolUse.type !== "tool_use") continue;
      captured.push(toolUse.name);

      // Execute the tool — reuse your existing tool handler logic
      // Recommended: extract executeToolCall(uid, toolName, input, db) into lib/tool-executor.ts
      const result = await executeToolCall(uid, toolUse.name, toolUse.input as Record<string, unknown>);
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: ALL_TOOLS,
      messages,
    });
  }

  // Final text response is the summary
  const summary = response.content
    .filter(b => b.type === "text")
    .map(b => (b as Anthropic.TextBlock).text)
    .join("\n");

  return NextResponse.json({ summary, captured });
}
```

---

## Refactoring Recommendation

The current `/api/chat/route.ts` is 5,000+ lines with tool definitions and tool execution logic combined. To share tools between `/api/chat` and `/api/ingest/transcript`, extract:

- **`lib/chat-tools.ts`** — the `tools` array (tool definitions/schemas only)
- **`lib/tool-executor.ts`** — `executeToolCall(uid, toolName, input)` function with all the Firestore logic

Both `/api/chat` and `/api/ingest/transcript` import from these shared files. This is worth doing before building the Realtime API too, which will need the same tools.

---

## UI: Capture Modal

Add a "Debrief" button to the chat panel header or dashboard. Opens a modal:

```
┌─────────────────────────────────┐
│  Quick Capture                  │
│                                 │
│  Context: [Doctor Visit    ▼]   │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Type or paste your      │   │
│  │ notes here...           │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  [🎤 Record]    [Capture →]    │
└─────────────────────────────────┘
```

Context dropdown options:
- General Debrief
- Doctor / Health Visit
- Workout
- Financial Conversation
- Relationship / Catchup

The [🎤 Record] button uses the existing Web Speech API voice input from ChatInterface — same code, just drops text into the textarea instead of the chat input.

---

## Context Types to Build First

| Context | Key tools fired | Most valuable for |
|---|---|---|
| `doctor_visit` | log_health, add_supplement, add_task | Health management |
| `workout_debrief` | log_workout, log_health | Fitness tracking |
| `financial_conversation` | add_transaction, add_decision | Budget awareness |
| `relationship_debrief` | log_interaction, add_task | People CRM |
| `general_debrief` | capture_to_second_brain, add_task, add_journal_entry | Catch-all |

---

## Future Extensions

- **Auto-context detection** — let Claude infer the context type from the transcript without the user selecting it
- **Meeting transcript import** — paste a Zoom/Google Meet transcript directly (see `MEETING_INGESTION.md`)
- **Scheduled debrief reminders** — push notification at 9pm: "Ready for your daily debrief?"

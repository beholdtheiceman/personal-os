import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "@/lib/env";
import type { ConstitutionMessage } from "@/types";

export const maxDuration = 60;

const GUIDE_SYSTEM = `You are a thoughtful, unhurried guide helping someone write their Personal Constitution — a living document that captures their deepest values, mission, and vision for their life.

Your role is to ask reflective questions ONE AT A TIME, listen carefully, and help the person go deeper. You are not a productivity coach. You are not trying to optimize anything. You are helping someone articulate what they already know about themselves but may not have put into words.

THE TEN QUESTIONS (ask them in this order, one at a time):
1. What would you regret not doing or becoming if your life ended sooner than expected?
2. When have you felt most fully alive — what were you doing, and why did it matter?
3. What do you want people to say about you at your funeral — not your accomplishments, but who you were?
4. What would you pursue if money, time, and fear were completely removed?
5. What are you most proud of in the last five years — and what does that reveal about what you actually value?
6. Where is the biggest gap between who you are today and who you want to become?
7. What are your 3–7 core values? For each one, write your personal definition — not the dictionary definition, but what that value means specifically to you and how you'd know you were living it.
8. What are the key roles you hold in your life (e.g., person of faith, husband/father, professional, friend)? For each role, what does excellence look like — in your own words?
9. What do you want your life to look like in 10 years across the domains that matter most to you?
10. What are your non-negotiables — the things you will not compromise regardless of circumstance or pressure?

RULES:
- Ask exactly ONE question at a time. Never ask two at once.
- After each response, briefly acknowledge what you heard (1 sentence), then ask the next question.
- Don't add unsolicited commentary or evaluation. Be a mirror, not a coach.
- When all 10 questions have been answered, say exactly: "SYNTHESIS_READY" on its own line, then generate the Personal Constitution document as described below.

CONSTITUTION FORMAT (only after all 10 answers):
After writing SYNTHESIS_READY, generate the constitution in this exact structure:

### Core Values
[List each value with the person's own definition]

### Personal Mission
[1–2 sentences synthesized from their answers]

### Life Roles
[Each role with their definition of excellence]

### 10-Year Vision
[What they described wanting their life to look like]

### Non-Negotiables
[List from their answer]

### Legacy
[Synthesized from their funeral/legacy answer]

Write it in first person, using their own words as much as possible. Make it feel like their document, not yours.`;

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

    const { messages } = (await req.json()) as { messages: ConstitutionMessage[] };

    // Convert to Anthropic message format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role === "guide" ? "assistant" : "user",
      content: m.content,
    }));

    // Anthropic requires at least one message — seed with a starter when the
    // interview is just beginning and the history is empty.
    const apiMessages: Anthropic.MessageParam[] =
      anthropicMessages.length === 0
        ? [{ role: "user", content: "Let's begin." }]
        : anthropicMessages;

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: GUIDE_SYSTEM,
      messages: apiMessages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Detect synthesis signal
    if (text.includes("SYNTHESIS_READY")) {
      const constitutionContent = text.replace(/SYNTHESIS_READY\s*/g, "").trim();
      return NextResponse.json({ type: "complete", content: constitutionContent });
    }

    return NextResponse.json({ type: "question", content: text });
  } catch (err) {
    console.error("[/api/constitution/interview]", err);
    return NextResponse.json({ error: "Interview failed" }, { status: 500 });
  }
}

# Meeting & Call Ingestion — Implementation Guide

## Overview

Automatically capture notes, action items, and decisions from meetings and phone calls into the app. Covers two scenarios: (1) meetings via a bot that joins video calls, and (2) phone calls via Twilio. Both produce a transcript that gets processed by Claude and filed into the appropriate Firestore collections.

**Estimated effort:** 1 week (meeting bot) + 3–4 days (phone calls)  
**Dependencies:** Recall.ai account (meetings), Twilio account (phone calls), `TRANSCRIPT_INGESTION.md` completed

---

## Part 1: Meeting Bot (Zoom, Google Meet, Teams)

### How it works

Recall.ai provides an API to create a bot that joins any video call via a link. The bot records audio, produces a transcript, and sends it to your webhook when the meeting ends. You process the transcript exactly like a manual debrief (see `TRANSCRIPT_INGESTION.md`).

### Setup

1. Create a Recall.ai account at recall.ai
2. Get your API key from the dashboard
3. Add to `.env.local`: `RECALL_API_KEY=your_key_here`

### New Endpoints

#### `app/api/meetings/bot/route.ts` — Send a bot to a meeting

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { uid } = await getAdminAuth().verifyIdToken(token);

  const { meetingUrl, context = "general_debrief", botName = "Larry's Assistant" } = await req.json();

  // Create the bot via Recall.ai
  const res = await fetch("https://us-west-2.recall.ai/api/v1/bot/", {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.RECALL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName,
      transcription_options: { provider: "assembly_ai" }, // or "deepgram"
      real_time_transcription: { destination_url: null }, // not needed for batch
      recording_mode: "audio_only",
      // Send transcript to our webhook when done
      calendar_meetings: null,
    }),
  });

  const bot = await res.json();

  // Store the bot ID linked to this user + context so the webhook knows what to do
  const db = getAdminDb();
  await db.collection("meeting_bots").doc(bot.id).set({
    uid,
    context,
    meetingUrl,
    status: "joining",
    created_at: new Date().toISOString(),
  });

  return NextResponse.json({ botId: bot.id, status: bot.status_changes?.[0]?.code });
}
```

#### `app/api/meetings/webhook/route.ts` — Receive transcript when meeting ends

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  // Verify Recall.ai webhook signature
  const signature = req.headers.get("x-recall-signature");
  // TODO: verify HMAC signature using RECALL_WEBHOOK_SECRET

  const event = await req.json();

  if (event.event !== "bot.done") {
    return NextResponse.json({ ok: true }); // ignore other events
  }

  const botId = event.data?.bot?.id;
  if (!botId) return NextResponse.json({ ok: true });

  // Look up which user + context this bot belongs to
  const db = getAdminDb();
  const botDoc = await db.collection("meeting_bots").doc(botId).get();
  if (!botDoc.exists) return NextResponse.json({ ok: true });

  const { uid, context } = botDoc.data()!;

  // Fetch the full transcript from Recall.ai
  const transcriptRes = await fetch(`https://us-west-2.recall.ai/api/v1/bot/${botId}/transcript/`, {
    headers: { Authorization: `Token ${process.env.RECALL_API_KEY}` },
  });
  const transcriptData = await transcriptRes.json();

  // Flatten transcript into a single string
  const transcript = transcriptData
    .map((seg: { speaker: string; words: { text: string }[] }) =>
      `${seg.speaker}: ${seg.words.map(w => w.text).join(" ")}`
    )
    .join("\n");

  // Process via your existing transcript ingestion logic
  // Import and call the same function used by /api/ingest/transcript
  await processTranscript(uid, transcript, context);

  // Update bot status
  await db.collection("meeting_bots").doc(botId).update({ status: "processed" });

  return NextResponse.json({ ok: true });
}
```

#### `app/api/meetings/status/route.ts` — Check bot status (poll from UI)

```ts
export async function GET(req: NextRequest) {
  const botId = req.nextUrl.searchParams.get("botId");
  const res = await fetch(`https://us-west-2.recall.ai/api/v1/bot/${botId}/`, {
    headers: { Authorization: `Token ${process.env.RECALL_API_KEY}` },
  });
  const data = await res.json();
  return NextResponse.json({ status: data.status_changes?.at(-1)?.code });
}
```

### Vercel Webhook Config

In `vercel.json`, add the webhook route so it isn't protected by auth middleware:
```json
{
  "routes": [
    { "src": "/api/meetings/webhook", "methods": ["POST"] }
  ]
}
```

Register your webhook URL in Recall.ai dashboard:
`https://your-app.vercel.app/api/meetings/webhook`

### UI: Send Bot to Meeting

Add a "Send bot to meeting" option in the chat panel or as a dashboard widget:

```
┌──────────────────────────────────────┐
│  📹 Join a Meeting                   │
│                                      │
│  Meeting link:                       │
│  [https://meet.google.com/...]       │
│                                      │
│  Context: [Work Meeting         ▼]  │
│                                      │
│  [Send Bot]                          │
└──────────────────────────────────────┘
```

After the meeting ends, the user gets a push notification: "Your meeting notes from [meeting name] have been captured."

---

## Part 2: Phone Call Integration (Twilio)

### How it works

You get a Twilio phone number. When a call comes in (or you conference the number in), Twilio streams audio to the OpenAI Realtime API. The agent listens, and when the call ends, the transcript is processed into your app.

### Setup

1. Create a Twilio account at twilio.com
2. Purchase a phone number
3. Add to `.env.local`:
   ```
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

### New Endpoints

#### `app/api/calls/incoming/route.ts` — Handle incoming call (TwiML)

```ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Twilio sends a POST when a call comes in
  // Respond with TwiML that connects to a Media Stream
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connected to your personal assistant.</Say>
  <Connect>
    <Stream url="wss://${process.env.VERCEL_URL}/api/calls/stream" />
  </Connect>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
```

#### `app/api/calls/stream/route.ts` — WebSocket bridge: Twilio ↔ OpenAI Realtime

This is the core — it bridges audio between Twilio's Media Streams WebSocket and the OpenAI Realtime API WebSocket.

```ts
// This needs to run as a WebSocket handler.
// Next.js App Router doesn't natively support WebSocket upgrades — 
// use a custom server or deploy as a separate service.
// The simplest approach is a small Express server on Railway/Render
// that handles just the WebSocket bridging, while Next.js stays on Vercel.

// See: github.com/openai/openai-realtime-twilio-demo for the full reference implementation
// OpenAI provides an official Twilio + Realtime API demo that handles:
// - Twilio audio format conversion (mulaw 8kHz → PCM16 24kHz)
// - Bidirectional WebSocket bridging
// - Tool call handling
// - Transcript accumulation
// - Session cleanup

// Key env vars needed by the bridge service:
// OPENAI_API_KEY, TWILIO_AUTH_TOKEN (for signature validation)
// PERSONAL_OS_API_URL (to call /api/ingest/transcript when call ends)
// PERSONAL_OS_CRON_SECRET (to authenticate server-to-server call)
```

### Simpler Alternative: Conference-In Flow

Instead of building a full WebSocket bridge, add the Twilio number to any call as a third participant. The number records, transcribes via AssemblyAI, and processes when you hang up. No real-time agent — just ambient recording + post-call processing.

---

## Context Detection

Rather than requiring the user to specify context before a meeting/call, let Claude infer it:

```ts
// In processTranscript, when context is "auto":
const detectedContext = await detectContext(transcript);
// Claude reads the first 500 words and returns one of:
// doctor_visit | workout_debrief | financial_conversation | relationship_debrief | work_meeting | general_debrief
```

---

## Privacy Considerations

- Store a `consent_to_record` field per contact in the People CRM
- Consider a verbal disclosure at the start of each call ("This call may be recorded for personal notes")
- Keep raw transcripts in Firestore with a TTL — only the processed/extracted data needs to persist long-term
- Add a "Delete my meeting data" option in Settings

---

## Suggested Build Order

1. **Recall.ai meeting bot** — higher value, simpler implementation, no WebSocket bridging needed
2. **Post-call transcript processing** — paste a Zoom transcript manually first to test the pipeline
3. **Twilio phone integration** — more complex, build after meeting bot is working well

# Voice Output (TTS) — Implementation Guide

## Overview

Add spoken responses to the existing chat pipeline. Claude already responds in text — this guide covers speaking that text back to the user. This is the fastest win toward a voice-first experience and requires no changes to the backend.

**Estimated effort:** 2–4 hours  
**Dependencies:** None (Option A) or `OPENAI_API_KEY` (Option B)

---

## Two Options

### Option A — Browser SpeechSynthesis (recommended starting point)

Zero cost, zero new dependencies, works in every modern browser. Voice quality is robotic on some platforms but perfectly usable.

```ts
// lib/tts.ts
export function speak(text: string, lang = "en-US") {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel(); // stop any current speech
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 1.05;
  utter.pitch = 1;
  // Pick a natural-sounding voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes("Google") || v.name.includes("Samantha"));
  if (preferred) utter.voice = preferred;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
}
```

### Option B — OpenAI TTS API (better voice quality)

Costs ~$0.015/1K characters. Returns an audio blob you play in the browser. Noticeably more natural than browser voices.

```ts
// app/api/tts/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text, voice = "alloy" } = await req.json();
  // voices: alloy | echo | fable | onyx | nova | shimmer
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "tts-1", input: text, voice }),
  });
  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
```

Client-side playback:
```ts
async function speakWithOpenAI(text: string) {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
}
```

---

## Wiring into ChatInterface.tsx

### 1. Add a TTS toggle to settings

Store the preference in Firestore `users/{uid}/settings/chat` or just `localStorage` for simplicity:

```ts
const [ttsEnabled, setTtsEnabled] = useState(() =>
  localStorage.getItem("tts_enabled") === "true"
);
```

Add a speaker icon toggle button in the chat toolbar next to the mic button.

### 2. Speak after each assistant response

In `ChatInterface.tsx`, find where assistant messages are appended after streaming completes. Call `speak()` there:

```ts
// After streaming finishes and the full assistant message is assembled:
if (ttsEnabled) {
  speak(assistantMessage); // Option A
  // or speakWithOpenAI(assistantMessage); // Option B
}
```

### 3. Stop speaking when the user starts typing or sends a new message

```ts
const handleSend = () => {
  stopSpeaking(); // cancel any current speech
  // ... existing send logic
};
```

### 4. Language support (for translation mode)

Pass the target language code to `speak()`:
```ts
speak(translatedText, "es-ES"); // Spanish
speak(translatedText, "ja-JP"); // Japanese
```

---

## Settings UI

Add a "Voice responses" toggle to the Settings page (`app/(pages)/settings`) and persist to Firestore alongside other notification settings. Include:
- Enable/disable toggle
- Voice selection dropdown (for Option A, list `speechSynthesis.getVoices()`)
- Speed slider (0.75× to 1.5×)

---

## Notes

- Strip markdown before speaking — asterisks, backticks, headers sound terrible out loud. Use a simple regex: `text.replace(/[#*`_~]/g, "")`.
- Chunk long responses — `SpeechSynthesisUtterance` has a ~32KB limit on some browsers. Split on sentence boundaries if needed.
- On iOS Safari, `speechSynthesis.speak()` requires a user gesture to initiate. The send button tap counts as one, so it works as long as TTS is triggered synchronously in the response handler.

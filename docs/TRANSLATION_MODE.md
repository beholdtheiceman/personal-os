# Real-Time Translation Mode — Implementation Guide

## Overview

A travel-ready voice translation mode that uses the OpenAI Realtime API for live two-way interpretation. Speak in English, hear the response in the target language. Works as both a passive translator (you speak, it translates for someone else to hear) and an active interpreter (back-and-forth conversation between two languages).

**Estimated effort:** 1 day (after Realtime API is implemented)  
**Dependencies:** `REALTIME_API.md` completed

---

## How It Works

Once the Realtime API is wired up, translation mode is simply a different system prompt and session configuration. No new infrastructure needed.

```
You (English) → Realtime API → GPT-4o translates → Spoken output in target language
Other person (target language) → Realtime API → GPT-4o translates → Spoken output in English
```

---

## Implementation

### 1. Translation Session Config

When starting a Realtime session in translation mode, override the system prompt and add a language context:

```ts
// In RealtimeVoice.tsx or a new TranslationMode.tsx component:

function buildTranslationPrompt(targetLanguage: string, mode: "one-way" | "two-way"): string {
  if (mode === "one-way") {
    return `You are a real-time interpreter. 
The user will speak in English. 
Translate everything they say into ${targetLanguage} and respond ONLY in ${targetLanguage}.
Speak naturally, as if you are the user speaking ${targetLanguage}.
Do not add explanations or commentary — just the translation.
If the user says something like "how do I say..." respond with just the phrase they're asking for.`;
  }

  return `You are a real-time interpreter facilitating a conversation between an English speaker and a ${targetLanguage} speaker.
When you hear English, translate to ${targetLanguage} and respond in ${targetLanguage}.
When you hear ${targetLanguage}, translate to English and respond in English.
Be natural and conversational. Do not add "(translated)" or similar markers.
If you cannot understand something due to background noise or accent, ask for clarification in the appropriate language.`;
}
```

### 2. Language Support

```ts
// lib/translation-languages.ts
export const SUPPORTED_LANGUAGES = [
  { code: "Spanish", locale: "es-ES", flag: "🇪🇸", quality: "excellent" },
  { code: "French", locale: "fr-FR", flag: "🇫🇷", quality: "excellent" },
  { code: "German", locale: "de-DE", flag: "🇩🇪", quality: "excellent" },
  { code: "Italian", locale: "it-IT", flag: "🇮🇹", quality: "excellent" },
  { code: "Portuguese", locale: "pt-BR", flag: "🇧🇷", quality: "excellent" },
  { code: "Japanese", locale: "ja-JP", flag: "🇯🇵", quality: "excellent" },
  { code: "Mandarin Chinese", locale: "zh-CN", flag: "🇨🇳", quality: "excellent" },
  { code: "Korean", locale: "ko-KR", flag: "🇰🇷", quality: "excellent" },
  { code: "Arabic", locale: "ar-SA", flag: "🇸🇦", quality: "good" },
  { code: "Hindi", locale: "hi-IN", flag: "🇮🇳", quality: "good" },
  { code: "Russian", locale: "ru-RU", flag: "🇷🇺", quality: "good" },
  { code: "Dutch", locale: "nl-NL", flag: "🇳🇱", quality: "good" },
  { code: "Thai", locale: "th-TH", flag: "🇹🇭", quality: "fair" },
  { code: "Vietnamese", locale: "vi-VN", flag: "🇻🇳", quality: "fair" },
  { code: "Turkish", locale: "tr-TR", flag: "🇹🇷", quality: "fair" },
  { code: "Polish", locale: "pl-PL", flag: "🇵🇱", quality: "fair" },
] as const;
```

### 3. TranslationMode Component

```tsx
// components/chat/TranslationMode.tsx
"use client";
import { useState } from "react";
import { SUPPORTED_LANGUAGES } from "@/lib/translation-languages";
import { RealtimeVoice } from "./RealtimeVoice";

export function TranslationMode() {
  const [targetLanguage, setTargetLanguage] = useState("Spanish");
  const [mode, setMode] = useState<"one-way" | "two-way">("two-way");
  const [active, setActive] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-4 bg-black/30 rounded-xl border border-white/10">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          🌐 Translation Mode
        </h3>
        {active && (
          <span className="text-xs text-green-400 animate-pulse">● Live</span>
        )}
      </div>

      {!active && (
        <>
          {/* Language picker */}
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Translate to</label>
            <select
              value={targetLanguage}
              onChange={e => setTargetLanguage(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.code}
                  {lang.quality === "fair" ? " (fair accuracy)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Mode picker */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("two-way")}
              className={`flex-1 py-2 rounded-lg text-xs border transition-all ${
                mode === "two-way"
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-white/5 border-white/10 text-text-secondary"
              }`}
            >
              🔄 Two-Way
              <div className="text-[10px] opacity-60 mt-0.5">Conversation interpreter</div>
            </button>
            <button
              onClick={() => setMode("one-way")}
              className={`flex-1 py-2 rounded-lg text-xs border transition-all ${
                mode === "one-way"
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-white/5 border-white/10 text-text-secondary"
              }`}
            >
              ➡️ One-Way
              <div className="text-[10px] opacity-60 mt-0.5">I speak, it translates</div>
            </button>
          </div>
        </>
      )}

      {/* Instructions when active */}
      {active && (
        <div className="text-xs text-text-secondary space-y-1">
          {mode === "two-way" ? (
            <>
              <p>🇺🇸 You speak English → {targetLanguage} comes out</p>
              <p>🌐 They speak {targetLanguage} → English comes out</p>
            </>
          ) : (
            <p>Speak in English → translated to {targetLanguage}</p>
          )}
        </div>
      )}

      {/* Realtime voice with translation config */}
      <RealtimeVoice
        mode="vad"
        translationConfig={
          active ? { targetLanguage, mode } : undefined
        }
        onSessionStart={() => setActive(true)}
        onSessionEnd={() => setActive(false)}
      />
    </div>
  );
}
```

### 4. Update RealtimeVoice to Accept Translation Config

Add a `translationConfig` prop to `RealtimeVoice`:

```ts
type RealtimeVoiceProps = {
  mode?: "push-to-talk" | "vad";
  translationConfig?: {
    targetLanguage: string;
    mode: "one-way" | "two-way";
  };
  onTranscript?: (text: string) => void;
  onToolCall?: (name: string, result: unknown) => void;
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
};
```

When building the session config, inject the translation prompt:

```ts
const instructions = translationConfig
  ? buildTranslationPrompt(translationConfig.targetLanguage, translationConfig.mode)
  : DEFAULT_ASSISTANT_PROMPT;

// In translation mode, disable all tools — pure interpreter
const tools = translationConfig ? [] : ALL_TOOLS;
```

---

## UI Placement

Add Translation Mode as:
1. A tab in the voice mode panel: **Assistant** | **Translator**
2. A quick-access button on the dashboard for travelers
3. Accessible via the skill system: `/translate spanish`

---

## Personal OS Context in Translation

Because this is your personal agent, you can blend translation with your data:

```
You: "Tell them I have a shellfish allergy"
Agent: [knows your health profile] → speaks in Spanish about shellfish allergy using the correct medical terminology

You: "Ask how much it costs and if it fits my budget for the trip"  
Agent: [knows your travel budget from savings goals] → asks the price, then tells you in English whether it fits
```

To enable this, don't fully disable tools in translation mode — keep a small subset active:
```ts
const tools = translationConfig
  ? ALL_TOOLS.filter(t => ["get_health_log", "get_budget_status", "get_savings_progress"].includes(t.name))
  : ALL_TOOLS;
```

---

## Offline Consideration

The Realtime API requires internet. For true travel reliability, consider also supporting the browser's built-in `SpeechSynthesis` with language codes as a fallback when connectivity is poor:

```ts
// Fallback: text translation via standard API + browser TTS
async function translateFallback(text: string, targetLang: string) {
  const response = await fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: `Translate to ${targetLang}: "${text}". Reply with only the translation.` }],
    }),
  });
  const { reply } = await response.json();
  const utter = new SpeechSynthesisUtterance(reply);
  utter.lang = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.locale ?? "en";
  speechSynthesis.speak(utter);
}
```

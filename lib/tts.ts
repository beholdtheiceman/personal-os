/**
 * Text-to-speech utilities.
 *
 * Current engine: browser SpeechSynthesis (free, no API key).
 * To swap to OpenAI TTS later: replace the `speak` function body with
 * a call to `speakWithOpenAI()` defined below, and add OPENAI_API_KEY
 * to env. The hook (hooks/useTTS.ts) and call sites don't need to change.
 */

// ── Markdown stripping ────────────────────────────────────────────────────────

export function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")              // headings
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")   // bold
    .replace(/\*([\s\S]+?)\*/g, "$1")       // italic
    .replace(/`{3}[\s\S]*?`{3}/g, "")      // fenced code blocks (skip entirely)
    .replace(/`([^`]+)`/g, "$1")            // inline code
    .replace(/~~([\s\S]+?)~~/g, "$1")       // strikethrough
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")    // links → label only
    .replace(/^[-*+]\s+/gm, "")            // unordered list bullets
    .replace(/^\d+\.\s+/gm, "")            // ordered list numbers
    .replace(/^>\s+/gm, "")                // blockquotes
    .replace(/\n{2,}/g, ". ")              // paragraph breaks → pause
    .replace(/\n/g, " ")
    .trim();
}

// ── Sentence chunker ──────────────────────────────────────────────────────────
// SpeechSynthesisUtterance has a ~32KB limit on some browsers.
// Chunking at sentence boundaries also produces more natural pausing.

function chunkText(text: string, maxLen = 300): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > maxLen && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

// ── Voice picker ──────────────────────────────────────────────────────────────

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const preferred = voices.find(
    (v) =>
      v.lang.startsWith(lang.slice(0, 2)) &&
      (v.name.includes("Google") ||
        v.name.includes("Samantha") ||
        v.name.includes("Alex") ||
        v.name.includes("Karen") ||
        v.name.includes("Daniel"))
  );
  return preferred ?? voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ?? null;
}

// ── Option A: Browser SpeechSynthesis (active) ───────────────────────────────

export function speak(text: string, lang = "en-US", rate = 1.05): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  window.speechSynthesis.cancel(); // stop anything currently playing

  const cleaned = stripMarkdown(text);
  if (!cleaned) return;

  const chunks = chunkText(cleaned);

  for (const chunk of chunks) {
    const utter = new SpeechSynthesisUtterance(chunk);
    utter.lang  = lang;
    utter.rate  = rate;
    utter.pitch = 1;

    // Voices may not be loaded yet on first call — re-query each utterance
    const voice = pickVoice(lang);
    if (voice) utter.voice = voice;

    window.speechSynthesis.speak(utter);
  }
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ── Option B: OpenAI TTS (swap in when ready) ─────────────────────────────────
// To upgrade: replace the `speak` export above with this function,
// create app/api/tts/route.ts (see docs/VOICE_TTS.md), add OPENAI_API_KEY to env.
// Cost: ~$0.015 / 1K characters (~$0.005 per typical Claude response).
//
// export async function speak(text: string, voice = "nova"): Promise<void> {
//   const cleaned = stripMarkdown(text);
//   if (!cleaned) return;
//   const res = await fetch("/api/tts", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ text: cleaned, voice }),
//   });
//   const blob = await res.blob();
//   const url = URL.createObjectURL(blob);
//   const audio = new Audio(url);
//   audio.play();
//   audio.onended = () => URL.revokeObjectURL(url);
// }

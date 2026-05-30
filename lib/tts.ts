/**
 * Text-to-speech utilities — OpenAI TTS (tts-1, "nova" voice).
 * Falls back gracefully if the API route is unavailable.
 * Cost: ~$0.015/1K characters (~$0.005 per typical Claude response).
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

// ── Active audio tracking (for stop support) ──────────────────────────────────

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;

function cleanupActive() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

// ── OpenAI TTS ────────────────────────────────────────────────────────────────

export async function speak(text: string, voice = "nova"): Promise<void> {
  if (typeof window === "undefined") return;

  const cleaned = stripMarkdown(text);
  if (!cleaned) return;

  cleanupActive(); // stop anything currently playing

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleaned, voice }),
    });

    if (!res.ok) return;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    activeAudio = audio;
    activeObjectUrl = url;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (activeObjectUrl === url) activeObjectUrl = null;
      if (activeAudio === audio) activeAudio = null;
    };

    audio.play();
  } catch {
    // Silently fail — TTS is non-critical
  }
}

export function stopSpeaking(): void {
  cleanupActive();
}

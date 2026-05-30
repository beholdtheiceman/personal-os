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

// ── AudioContext-based playback (no blob URLs, no CSP media-src issues) ──────

let audioCtx: AudioContext | null = null;
let activeSource: AudioBufferSourceNode | null = null;

function getAudioCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Call on any user gesture to unlock the AudioContext for subsequent async playback. */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
}

function stopActive() {
  if (activeSource) {
    try { activeSource.stop(); } catch { /* already stopped */ }
    activeSource = null;
  }
}

// ── OpenAI TTS ────────────────────────────────────────────────────────────────

export async function speak(text: string, voice = "nova"): Promise<void> {
  if (typeof window === "undefined") return;

  const cleaned = stripMarkdown(text);
  if (!cleaned) return;

  stopActive();

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleaned, voice }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.status.toString());
      console.error("[TTS] API error:", res.status, err);
      return;
    }

    const arrayBuffer = await res.arrayBuffer();
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") await ctx.resume();

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    activeSource = source;
    source.onended = () => { if (activeSource === source) activeSource = null; };
    source.start(0);
  } catch (e) {
    console.error("[TTS] error:", e);
  }
}

export function stopSpeaking(): void {
  stopActive();
}

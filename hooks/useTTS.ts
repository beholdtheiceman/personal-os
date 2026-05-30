import { useState } from "react";
import { speak, stopSpeaking } from "@/lib/tts";

const STORAGE_KEY = "tts_enabled";

export function useTTS() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
    if (!next) stopSpeaking();
  }

  /** Call after an assistant response is ready. No-ops when TTS is disabled. */
  function speakResponse(text: string) {
    console.log("[TTS] speakResponse called — enabled:", enabled, "text length:", text?.length);
    if (enabled && text) speak(text).catch(() => {});
  }

  /** Stop any in-progress speech (call before sending a new message). */
  function stop() {
    stopSpeaking();
  }

  return { enabled, toggle, speakResponse, stop };
}

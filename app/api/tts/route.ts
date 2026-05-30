import { NextRequest, NextResponse } from "next/server";

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const MAX_CHARS = 4096;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TTS not configured" }, { status: 503 });
  }

  const { text, voice = "nova" } = await req.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const truncated = text.slice(0, MAX_CHARS);

  const res = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: truncated,
      voice,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI TTS error:", err);
    return NextResponse.json({ error: "TTS failed" }, { status: 502 });
  }

  const audioBuffer = await res.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}

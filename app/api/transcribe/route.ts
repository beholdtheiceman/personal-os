// POST /api/transcribe — receives audio blob, returns text via OpenAI Whisper
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  // Require authenticated user
  const authHeader = req.headers.get("Authorization") ?? "";
  const idToken = authHeader.replace("Bearer ", "");
  try {
    await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio file too large (max 10 MB)" }, { status: 413 });
    }

    // Forward to OpenAI Whisper
    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "recording.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: whisperForm,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Whisper error:", err);
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ text: data.text });
  } catch (err) {
    console.error("Transcribe route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

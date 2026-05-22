import { NextRequest, NextResponse } from "next/server";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://suno.com/",
};

async function resolveAudioUrl(url: string): Promise<string | null> {
  // Try to extract the real audio URL from a Suno share page
  try {
    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Accept: "text/html" },
    });
    const html = await res.text();

    // Suno embeds song data in __NEXT_DATA__ or as JSON in script tags
    const patterns = [
      /"audio_url"\s*:\s*"(https?:[^"]+\.mp3[^"]*)"/,
      /"audio_url"\s*:\s*"(https?:[^"]+)"/,
      /property="og:audio"\s+content="([^"]+)"/,
      /content="([^"]+)"\s+property="og:audio"/,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]) return m[1].replace(/\\u0026/g, "&");
    }
  } catch {
    // ignore
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const isSunoCdn = parsed.hostname !== "suno.ai" && parsed.hostname.endsWith(".suno.ai");
  const isSunoShare = parsed.hostname === "suno.com";
  const isVercelBlob = parsed.hostname.endsWith(".public.blob.vercel-storage.com");

  if (!isSunoCdn && !isSunoShare && !isVercelBlob) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  // Vercel Blob — private store requires the read/write token for access
  if (isVercelBlob) {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    const headers: Record<string, string> = {};
    if (blobToken) headers["Authorization"] = `Bearer ${blobToken}`;
    const upstream = await fetch(url, { headers });
    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream returned ${upstream.status}` }, { status: upstream.status });
    }
    const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // For share pages, extract the real audio URL first
  let audioUrl = url;
  if (isSunoShare) {
    const resolved = await resolveAudioUrl(url);
    if (!resolved) {
      return NextResponse.json(
        { error: "Could not extract audio URL from Suno page. Download the MP3 from Suno and use a direct link instead." },
        { status: 422 }
      );
    }
    audioUrl = resolved;
  }

  let upstream: Response;
  try {
    upstream = await fetch(audioUrl, {
      headers: {
        ...BROWSER_HEADERS,
        Accept: "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,*/*;q=0.5",
        Origin: "https://suno.com",
      },
    });
  } catch (err) {
    console.error("[audio-proxy] fetch error:", err);
    return NextResponse.json({ error: "Failed to reach audio source" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: `Upstream returned ${upstream.status}` }, { status: upstream.status });
  }

  const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";
  const contentLength = upstream.headers.get("content-length");
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
  };
  if (contentLength) headers["Content-Length"] = contentLength;

  return new NextResponse(upstream.body, { headers });
}

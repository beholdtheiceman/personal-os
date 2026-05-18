import { NextRequest, NextResponse } from "next/server";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });
  if (!YOUTUBE_API_KEY) return NextResponse.json({ error: "YouTube API not configured" }, { status: 500 });

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("q", q);
  url.searchParams.set("key", YOUTUBE_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return NextResponse.json({ error: "YouTube API error" }, { status: res.status });

  const data = await res.json();
  const decodeHtml = (str: string) =>
    str.replace(/&amp;/g, "&")
       .replace(/&lt;/g, "<")
       .replace(/&gt;/g, ">")
       .replace(/&quot;/g, '"')
       .replace(/&#39;/g, "'")
       .replace(/&apos;/g, "'");

  const items = (data.items ?? []).map((item: {
    id: { videoId: string };
    snippet: { title: string; channelTitle: string; thumbnails: { medium: { url: string } } };
  }) => ({
    videoId: item.id.videoId,
    title: decodeHtml(item.snippet.title),
    channel: decodeHtml(item.snippet.channelTitle),
    thumbnail: item.snippet.thumbnails.medium.url,
  }));

  return NextResponse.json(items);
}

// GET /api/bible/passage?book=John&chapter=3
// Fetches an entire chapter from labs.bible.org (NET Bible). Public, no auth required.
// Use /api/bible/log-read separately to record that the user opened it.
import { NextRequest, NextResponse } from "next/server";

type BibleApiVerse = {
  bookname?: string;
  chapter?: string;
  verse?: string;
  text?: string;
};

export async function GET(req: NextRequest) {
  const book = req.nextUrl.searchParams.get("book");
  const chapterStr = req.nextUrl.searchParams.get("chapter");
  if (!book || !chapterStr) {
    return NextResponse.json({ error: "Missing book or chapter" }, { status: 400 });
  }
  const chapter = parseInt(chapterStr, 10);
  if (isNaN(chapter) || chapter < 1) {
    return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
  }

  const passage = `${book} ${chapter}`;
  const url = `https://labs.bible.org/api/?passage=${encodeURIComponent(passage)}&type=json`;

  try {
    // Cache for 24h — chapter content never changes
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json({ error: "Bible API error" }, { status: 502 });

    const data = (await res.json()) as BibleApiVerse[];
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Passage not found" }, { status: 404 });
    }

    const verses = data
      .map((v) => ({
        verse: parseInt(v.verse ?? "0", 10),
        text: (v.text ?? "").replace(/<[^>]+>/g, "").trim(),
      }))
      .filter((v) => v.verse > 0 && v.text);

    return NextResponse.json({
      book,
      chapter,
      reference: `${book} ${chapter}`,
      translation: "NET",
      verses,
    });
  } catch (e) {
    console.error("[bible/passage] error:", e);
    return NextResponse.json({ error: "Failed to fetch passage" }, { status: 500 });
  }
}

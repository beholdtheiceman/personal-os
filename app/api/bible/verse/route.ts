// GET /api/bible/verse — returns the verse of the day
import { NextResponse } from "next/server";

const FALLBACK = {
  text: "I can do all things through Christ who strengthens me.",
  reference: "Philippians 4:13",
};

export async function GET() {
  try {
    const res = await fetch(
      "https://labs.bible.org/api/?passage=votd&type=json",
      { next: { revalidate: 3600 } } // cache for 1 hour
    );
    if (!res.ok) return NextResponse.json(FALLBACK);

    const data = await res.json();
    const verse = data[0];
    if (!verse?.text) return NextResponse.json(FALLBACK);

    // Strip HTML tags the API sometimes includes
    const text = verse.text.replace(/<[^>]+>/g, "").trim();
    const reference = `${verse.bookname} ${verse.chapter}:${verse.verse}`;

    return NextResponse.json({ text, reference });
  } catch {
    return NextResponse.json(FALLBACK);
  }
}

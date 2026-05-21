"use client";
// BibleReader — book/chapter picker + passage display.
// Loads a chapter from /api/bible/passage and fire-and-forget logs it
// to /api/bible/log-read so chat tooling can surface reading history.
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BIBLE_BOOKS } from "@/lib/bible-books";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";

type Verse = { verse: number; text: string };

export default function BibleReader() {
  const { user } = useAuth();
  const [bookName, setBookName] = useState("John");
  const [chapter, setChapter] = useState(1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentBook = BIBLE_BOOKS.find((b) => b.name === bookName) ?? BIBLE_BOOKS[0];

  const loadPassage = useCallback(
    async (book: string, ch: number) => {
      setLoading(true);
      setError(null);
      setVerses([]);
      try {
        const res = await fetch(
          `/api/bible/passage?book=${encodeURIComponent(book)}&chapter=${ch}`
        );
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error ?? "Failed to load passage");
        }
        const data = (await res.json()) as { verses?: Verse[] };
        setVerses(data.verses ?? []);

        // Fire-and-forget read log. Never blocks the UI on logging failures.
        if (user) {
          user
            .getIdToken()
            .then((idToken) =>
              fetch("/api/bible/log-read", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ book, chapter: ch, translation: "NET" }),
              }).catch(() => {})
            )
            .catch(() => {});
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load passage");
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  useEffect(() => {
    loadPassage(bookName, chapter);
  }, [bookName, chapter, loadPassage]);

  const goToPrev = () => {
    if (chapter > 1) {
      setChapter(chapter - 1);
      return;
    }
    const idx = BIBLE_BOOKS.findIndex((b) => b.name === bookName);
    if (idx > 0) {
      const prevBook = BIBLE_BOOKS[idx - 1];
      setBookName(prevBook.name);
      setChapter(prevBook.chapters);
    }
  };

  const goToNext = () => {
    if (chapter < currentBook.chapters) {
      setChapter(chapter + 1);
      return;
    }
    const idx = BIBLE_BOOKS.findIndex((b) => b.name === bookName);
    if (idx >= 0 && idx < BIBLE_BOOKS.length - 1) {
      setBookName(BIBLE_BOOKS[idx + 1].name);
      setChapter(1);
    }
  };

  const handleBookChange = (newBook: string) => {
    setBookName(newBook);
    setChapter(1);
  };

  return (
    <div className="space-y-4">
      {/* Navigation controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={bookName}
          onChange={(e) => handleBookChange(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/10 text-text-primary text-sm border border-white/10 focus:outline-none focus:border-accent"
        >
          <optgroup label="Old Testament">
            {BIBLE_BOOKS.filter((b) => b.testament === "OT").map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="New Testament">
            {BIBLE_BOOKS.filter((b) => b.testament === "NT").map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </optgroup>
        </select>

        <select
          value={chapter}
          onChange={(e) => setChapter(parseInt(e.target.value, 10))}
          className="px-3 py-2 rounded-lg bg-white/10 text-text-primary text-sm border border-white/10 focus:outline-none focus:border-accent"
        >
          {Array.from({ length: currentBook.chapters }, (_, i) => i + 1).map((c) => (
            <option key={c} value={c}>
              Chapter {c}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={goToPrev}
            disabled={loading}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
            aria-label="Previous chapter"
          >
            <RiArrowLeftSLine className="w-5 h-5" />
          </button>
          <button
            onClick={goToNext}
            disabled={loading}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/10 text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
            aria-label="Next chapter"
          >
            <RiArrowRightSLine className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Passage display */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div className="mb-4">
          <h2 className="text-2xl font-semibold text-text-primary">
            {bookName} {chapter}
          </h2>
          <p className="text-xs text-text-secondary mt-1">NET Bible</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="text-text-secondary text-sm py-4">{error}</div>
        )}

        {!loading && !error && verses.length > 0 && (
          <div className="space-y-2 leading-relaxed text-text-primary">
            {verses.map((v) => (
              <p key={v.verse} className="text-base">
                <span className="text-accent text-xs font-semibold align-super mr-1">
                  {v.verse}
                </span>
                {v.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

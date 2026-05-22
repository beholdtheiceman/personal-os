"use client";
import { useState } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { RiSearchLine, RiPlayLine, RiYoutubeLine } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";

interface YTResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export default function YouTubeTab() {
  const { play, currentTrack, isPlaying } = usePlayer();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YTResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/media/youtube/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search();
  };

  const isActive = (videoId: string) =>
    currentTrack?.type === "youtube" && currentTrack.videoId === videoId;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search YouTube..."
          className="flex-1 bg-bg-tertiary border border-bg-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="btn-primary flex items-center gap-1.5 px-4"
        >
          {loading ? <LoadingDots /> : <><RiSearchLine className="w-4 h-4" /> Search</>}
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex justify-center py-8"><LoadingDots /></div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-center text-text-muted text-sm py-8">No results found.</p>
      )}

      {!loading && results.length === 0 && !searched && (
        <div className="flex flex-col items-center py-12 gap-3 text-text-muted">
          <RiYoutubeLine className="w-10 h-10 text-red-400/50" />
          <p className="text-sm">Search for a video to get started</p>
        </div>
      )}

      <div className="space-y-2">
        {results.map((r) => {
          const active = isActive(r.videoId);
          return (
            <button
              key={r.videoId}
              onClick={() => play({ type: "youtube", videoId: r.videoId, title: r.title, thumbnail: r.thumbnail })}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                active
                  ? "border-accent/40 bg-accent/10"
                  : "border-bg-border hover:bg-bg-tertiary"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.thumbnail} alt="" className="w-20 h-14 rounded object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium line-clamp-2 ${active ? "text-accent" : "text-text-primary"}`}>
                  {r.title}
                </p>
                <p className="text-xs text-text-muted mt-0.5 truncate">{r.channel}</p>
              </div>
              <div className={`w-8 h-8 flex items-center justify-center rounded-full shrink-0 ${
                active && isPlaying ? "text-accent" : "text-text-muted"
              }`}>
                <RiPlayLine className="w-4 h-4" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

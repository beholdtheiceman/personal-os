"use client";
import { usePlayer } from "@/contexts/PlayerContext";
import { RiPlayLine, RiPauseLine, RiStopLine, RiMusicLine, RiYoutubeLine } from "react-icons/ri";

export default function MiniPlayer() {
  const { currentTrack, isPlaying, pause, resume, stop } = usePlayer();

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-[57px] md:bottom-0 left-0 right-0 z-30 px-4 py-2 flex items-center gap-3"
      style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderTop: "1px solid rgba(255,255,255,0.6)" }}
    >
      {/* Track icon */}
      <div className="w-8 h-8 rounded-md bg-accent/15 flex items-center justify-center shrink-0">
        {currentTrack.type === "youtube" ? (
          <RiYoutubeLine className="w-4 h-4 text-red-400" />
        ) : (
          <RiMusicLine className="w-4 h-4 text-accent" />
        )}
      </div>

      {/* Thumbnail for YouTube */}
      {currentTrack.type === "youtube" && currentTrack.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentTrack.thumbnail}
          alt=""
          className="w-8 h-8 rounded-md object-cover shrink-0 hidden sm:block"
        />
      )}

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{currentTrack.title}</p>
        <p className="text-xs text-text-muted">{currentTrack.type === "youtube" ? "YouTube" : "Suno"}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={isPlaying ? pause : resume}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-tertiary text-text-primary transition-colors"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <RiPauseLine className="w-4 h-4" /> : <RiPlayLine className="w-4 h-4" />}
        </button>
        <button
          onClick={stop}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-tertiary text-text-muted transition-colors"
          aria-label="Stop"
        >
          <RiStopLine className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile safe-area spacer */}
      <div className="md:hidden w-0" />
    </div>
  );
}

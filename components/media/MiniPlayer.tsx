"use client";
import { useState } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import {
  RiPlayLine, RiPauseLine, RiStopLine, RiMusicLine, RiYoutubeLine,
  RiVolumeUpLine, RiVolumeMuteLine, RiArrowUpLine, RiArrowDownLine,
} from "react-icons/ri";

function ExpandedPlayer({ onCollapse }: { onCollapse: () => void }) {
  const { currentTrack, isPlaying, volume, pause, resume, stop, setVolume } = usePlayer();
  if (!currentTrack) return null;

  const hasThumbnail = currentTrack.type === "youtube" && currentTrack.thumbnail;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "rgba(20,10,16,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
    >
      {/* Collapse button */}
      <button
        onClick={onCollapse}
        className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Collapse"
      >
        <RiArrowDownLine className="w-5 h-5" />
      </button>

      {/* Album art */}
      <div className="mb-8">
        {hasThumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(currentTrack as { thumbnail: string }).thumbnail}
            alt={currentTrack.title}
            className="w-64 h-64 rounded-2xl object-cover shadow-2xl"
          />
        ) : (
          <div className="w-64 h-64 rounded-2xl bg-gradient-to-br from-accent/60 to-accent-hover flex items-center justify-center shadow-2xl">
            <RiMusicLine className="w-24 h-24 text-white/60" />
          </div>
        )}
      </div>

      {/* Title */}
      <div className="text-center mb-8 px-8 max-w-sm">
        <p className="text-white font-semibold text-lg leading-snug line-clamp-2">{currentTrack.title}</p>
        <p className="text-white/50 text-sm mt-1">{currentTrack.type === "youtube" ? "YouTube" : "The Crate"}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 mb-10">
        <button
          onClick={isPlaying ? pause : resume}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-accent hover:bg-accent-hover text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <RiPauseLine className="w-7 h-7" /> : <RiPlayLine className="w-7 h-7" />}
        </button>
        <button
          onClick={() => { stop(); onCollapse(); }}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
          aria-label="Stop"
        >
          <RiStopLine className="w-5 h-5" />
        </button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3 w-64">
        <button
          onClick={() => setVolume(volume === 0 ? 80 : 0)}
          className="text-white/50 hover:text-white transition-colors shrink-0"
          aria-label={volume === 0 ? "Unmute" : "Mute"}
        >
          {volume === 0 ? <RiVolumeMuteLine className="w-5 h-5" /> : <RiVolumeUpLine className="w-5 h-5" />}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 h-1 accent-accent cursor-pointer"
          aria-label="Volume"
        />
        <span className="text-white/40 text-xs w-6 text-right">{volume}</span>
      </div>
    </div>
  );
}

export default function MiniPlayer() {
  const { currentTrack, isPlaying, volume, pause, resume, stop, setVolume } = usePlayer();
  const [expanded, setExpanded] = useState(false);

  if (!currentTrack) return null;

  return (
    <>
      {expanded && <ExpandedPlayer onCollapse={() => setExpanded(false)} />}

      <div
        className="fixed bottom-[57px] md:bottom-0 left-0 right-0 z-30 px-4 py-2.5 flex items-center gap-3"
        style={{
          background: "rgba(15, 6, 13, 0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(196, 114, 138, 0.2)",
        }}
      >
        {/* Album art / icon — click to expand */}
        <button
          onClick={() => setExpanded(true)}
          className="shrink-0 group relative"
          aria-label="Expand player"
        >
          {currentTrack.type === "youtube" && currentTrack.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentTrack.thumbnail}
              alt=""
              className="w-9 h-9 rounded-md object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-md bg-accent/20 flex items-center justify-center">
              {currentTrack.type === "youtube"
                ? <RiYoutubeLine className="w-4 h-4 text-red-400" />
                : <RiMusicLine className="w-4 h-4 text-accent" />}
            </div>
          )}
          <div className="absolute inset-0 rounded-md bg-black/0 group-hover:bg-white/10 flex items-center justify-center transition-colors">
            <RiArrowUpLine className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>

        {/* Title — also clickable to expand */}
        <button onClick={() => setExpanded(true)} className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-white truncate">{currentTrack.title}</p>
          <p className="text-xs text-accent/70">{currentTrack.type === "youtube" ? "YouTube" : "The Crate"}</p>
        </button>

        {/* Volume */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setVolume(volume === 0 ? 80 : 0)}
            className="text-white/40 hover:text-white/80 transition-colors"
            aria-label={volume === 0 ? "Unmute" : "Mute"}
          >
            {volume === 0 ? <RiVolumeMuteLine className="w-4 h-4" /> : <RiVolumeUpLine className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 h-1 accent-accent cursor-pointer"
            aria-label="Volume"
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={isPlaying ? pause : resume}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-accent/20 hover:bg-accent/40 text-white transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <RiPauseLine className="w-4 h-4" /> : <RiPlayLine className="w-4 h-4" />}
          </button>
          <button
            onClick={stop}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
            aria-label="Stop"
          >
            <RiStopLine className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}

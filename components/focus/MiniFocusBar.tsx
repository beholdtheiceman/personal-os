"use client";
import { RiPauseLine, RiPlayLine, RiStopLine } from "react-icons/ri";
import { useTimer } from "@/contexts/TimerContext";
import { usePlayer } from "@/contexts/PlayerContext";
import Link from "next/link";

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function MiniFocusBar() {
  const { status, taskName, secondsRemaining, durationMin, pause, resume, stop } = useTimer();
  const { currentTrack } = usePlayer();

  if (status === "idle") return null;

  const hasPlayer = !!currentTrack;
  // MiniPlayer sits at bottom-[57px] md:bottom-0 and is ~56px tall
  const bottomClass = hasPlayer
    ? "bottom-[113px] md:bottom-[56px]"
    : "bottom-[57px] md:bottom-0";

  const isBreak = status === "break";
  const progress = durationMin > 0 ? Math.max(0, Math.min(1, secondsRemaining / (durationMin * 60))) : 0;

  return (
    <div
      className={`fixed left-0 right-0 z-29 flex items-center gap-3 px-4 py-2 ${bottomClass}`}
      style={{
        background: "rgba(15, 6, 13, 0.94)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: `1px solid ${isBreak ? "rgba(52,211,153,0.3)" : "rgba(167,139,250,0.3)"}`,
      }}
    >
      {/* Progress bar at top edge */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-bg-tertiary">
        <div
          className={`h-full transition-all duration-1000 ${isBreak ? "bg-success" : "bg-accent"}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${isBreak ? "bg-success" : status === "paused" ? "bg-amber-400" : "bg-accent animate-pulse"}`} />

      {/* Label */}
      <Link href="/focus" className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
        <p className="text-xs font-medium text-text-primary truncate">
          {isBreak ? "Break time" : taskName}
        </p>
        <p className={`text-xs font-bold tabular-nums ${isBreak ? "text-success" : "text-accent"}`}>
          {fmtTime(secondsRemaining)} {isBreak ? "remaining" : status === "paused" ? "· paused" : "· focus"}
        </p>
      </Link>

      {/* Controls */}
      {!isBreak && (
        <>
          {status === "running" ? (
            <button onClick={pause} className="w-8 h-8 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <RiPauseLine className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={resume} className="w-8 h-8 rounded-full bg-accent/20 hover:bg-accent/30 text-accent flex items-center justify-center shrink-0">
              <RiPlayLine className="w-4 h-4" />
            </button>
          )}
        </>
      )}
      <button onClick={stop} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-text-muted flex items-center justify-center shrink-0">
        <RiStopLine className="w-4 h-4" />
      </button>
    </div>
  );
}

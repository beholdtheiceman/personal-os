"use client";
import { RiStopLine } from "react-icons/ri";
import { useScene } from "@/contexts/SceneContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTimer } from "@/contexts/TimerContext";

export default function MiniSceneBar() {
  const { activeScene, deactivate } = useScene();
  const { currentTrack } = usePlayer();
  const { status: timerStatus } = useTimer();

  if (!activeScene) return null;

  const hasPlayer = !!currentTrack;
  const hasTimer = timerStatus !== "idle";

  // Stack from bottom: MobileNav(57px) → SceneBar(40px) → FocusBar(44px) → Player(56px)
  // Scene bar sits just above mobile nav on mobile, at the very bottom on desktop.
  // When FocusBar or Player are also active this bar doesn't move — they stack above it.
  // MiniFocusBar reads hasScene from context and adjusts its own bottom accordingly.
  const bottomClass =
    hasPlayer && hasTimer
      ? "bottom-[157px] md:bottom-[100px]"
      : hasPlayer
        ? "bottom-[113px] md:bottom-[56px]"
        : hasTimer
          ? "bottom-[101px] md:bottom-[44px]"
          : "bottom-[57px] md:bottom-0";

  return (
    <div
      className={`fixed left-0 right-0 z-28 flex items-center gap-3 px-4 ${bottomClass}`}
      style={{
        height: "40px",
        background: "rgba(15, 6, 13, 0.94)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: `1px solid ${activeScene.colorClass}`,
      }}
    >
      <span className="text-sm leading-none">{activeScene.icon}</span>
      <span className="flex-1 min-w-0 text-xs font-medium text-text-primary truncate">
        {activeScene.name} mode
      </span>
      <button
        onClick={deactivate}
        className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-text-muted flex items-center justify-center shrink-0 transition-colors"
        title="End scene"
      >
        <RiStopLine className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

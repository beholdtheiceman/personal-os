"use client";
import { RiArrowRightLine, RiStopLine } from "react-icons/ri";
import { useSOP } from "@/contexts/SOPContext";
import { useScene } from "@/contexts/SceneContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { useTimer } from "@/contexts/TimerContext";

export default function MiniSOPBar() {
  const { sopId, sopTitle, stepIndex, totalSteps, deactivateSOP, advanceStep } = useSOP();
  const { activeScene } = useScene();
  const { currentTrack } = usePlayer();
  const { status: timerStatus } = useTimer();

  if (!sopId) return null;

  const hasScene  = !!activeScene;
  const hasPlayer = !!currentTrack;
  const hasTimer  = timerStatus !== "idle";

  // Stack above MiniSceneBar (40px) which sits above MobileNav (57px)
  const mobileBase = 57 + (hasScene ? 40 : 0) + (hasTimer ? 44 : 0) + (hasPlayer ? 56 : 0);
  const deskBase   =  0 + (hasScene ? 40 : 0) + (hasTimer ? 44 : 0) + (hasPlayer ? 56 : 0);

  const isLast  = stepIndex >= totalSteps - 1;
  const current = stepIndex + 1;

  return (
    <>
      <style>{`.mini-sop-bar{bottom:${mobileBase}px}@media(min-width:768px){.mini-sop-bar{bottom:${deskBase}px}}`}</style>
      <div
        className="mini-sop-bar fixed left-0 right-0 z-27 flex items-center gap-3 px-4"
        style={{
          height: "40px",
          background: "rgba(12, 5, 18, 0.94)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(99,179,237,0.35)",
        }}
      >
        <span className="text-sm leading-none">📋</span>
        <span className="flex-1 min-w-0 text-xs font-medium text-text-primary truncate">
          {sopTitle ?? "SOP"}{totalSteps > 0 && ` — step ${current}/${totalSteps}`}
        </span>
        {!isLast && (
          <button
            onClick={advanceStep}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-text-secondary transition-colors"
            title="Next step"
          >
            Next <RiArrowRightLine className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={deactivateSOP}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-text-muted flex items-center justify-center shrink-0 transition-colors"
          title="End SOP"
        >
          <RiStopLine className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}

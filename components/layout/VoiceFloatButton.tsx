"use client";
import { usePlayer } from "@/contexts/PlayerContext";
import { RealtimeVoice } from "@/components/chat/RealtimeVoice";

export default function VoiceFloatButton() {
  const { currentTrack } = usePlayer();
  const bottom = currentTrack ? "bottom-32 md:bottom-20" : "bottom-20 md:bottom-6";

  return (
    <div className={`fixed right-4 z-50 ${bottom}`}>
      <RealtimeVoice float />
    </div>
  );
}

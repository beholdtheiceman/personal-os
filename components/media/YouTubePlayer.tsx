"use client";
import { useEffect, useRef } from "react";
import { usePlayer, YTPlayer } from "@/contexts/PlayerContext";

declare global {
  interface Window {
    YT: {
      Player: new (el: HTMLElement | string, opts: object) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function YouTubePlayer() {
  const { onYTReady, onYTStateChange } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  useEffect(() => {
    const initPlayer = () => {
      if (!containerRef.current) return;
      const player = new window.YT.Player(containerRef.current, {
        height: "0",
        width: "0",
        playerVars: { autoplay: 1 },
        events: {
          onReady: () => {
            playerRef.current = player;
            onYTReady(player);
          },
          onStateChange: (e: { data: number }) => onYTStateChange(e.data),
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    }
  }, [onYTReady, onYTStateChange]);

  return (
    <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
      <div ref={containerRef} />
    </div>
  );
}

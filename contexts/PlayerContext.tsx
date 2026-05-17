"use client";
import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";

export type PlayerTrack =
  | { type: "youtube"; videoId: string; title: string; thumbnail: string }
  | { type: "suno"; url: string; title: string };

interface PlayerContextType {
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  play: (track: PlayerTrack) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  ytPlayerRef: React.MutableRefObject<YTPlayer | null>;
  onYTReady: (player: YTPlayer) => void;
  onYTStateChange: (state: number) => void;
}

// Minimal YT player interface (avoids importing @types/youtube)
export interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  loadVideoById: (videoId: string) => void;
  getPlayerState: () => number;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);

  const stopCurrent = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (ytPlayerRef.current) {
      try { ytPlayerRef.current.stopVideo(); } catch {}
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback((track: PlayerTrack) => {
    stopCurrent();
    setCurrentTrack(track);
    setIsPlaying(true);

    if (track.type === "suno") {
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = `/api/media/audio-proxy?url=${encodeURIComponent(track.url)}`;
          audioRef.current.play().catch(console.error);
        }
      }, 50);
    } else if (track.type === "youtube") {
      setTimeout(() => {
        if (ytPlayerRef.current) {
          ytPlayerRef.current.loadVideoById(track.videoId);
        }
      }, 50);
    }
  }, [stopCurrent]);

  const pause = useCallback(() => {
    if (currentTrack?.type === "suno") audioRef.current?.pause();
    if (currentTrack?.type === "youtube") {
      try { ytPlayerRef.current?.pauseVideo(); } catch {}
    }
    setIsPlaying(false);
  }, [currentTrack]);

  const resume = useCallback(() => {
    if (currentTrack?.type === "suno") {
      if (audioRef.current && !audioRef.current.src) {
        audioRef.current.src = `/api/media/audio-proxy?url=${encodeURIComponent(currentTrack.url)}`;
      }
      audioRef.current?.play().catch(console.error);
    }
    if (currentTrack?.type === "youtube") {
      try { ytPlayerRef.current?.playVideo(); } catch {}
    }
    setIsPlaying(true);
  }, [currentTrack]);

  const stop = useCallback(() => {
    stopCurrent();
    setCurrentTrack(null);
  }, [stopCurrent]);

  const onYTReady = useCallback((player: YTPlayer) => {
    ytPlayerRef.current = player;
  }, []);

  const onYTStateChange = useCallback((state: number) => {
    // YT.PlayerState: PLAYING=1, PAUSED=2, ENDED=0
    if (state === 1) setIsPlaying(true);
    if (state === 2 || state === 0) setIsPlaying(false);
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentTrack, isPlaying, play, pause, resume, stop,
      audioRef, ytPlayerRef, onYTReady, onYTStateChange,
    }}>
      {children}
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

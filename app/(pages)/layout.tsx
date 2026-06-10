"use client";
import { useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import TopNav from "@/components/layout/TopNav";
import MobileNav from "@/components/layout/MobileNav";
import VoiceFloatButton from "@/components/layout/VoiceFloatButton";
import { PlayerProvider, usePlayer } from "@/contexts/PlayerContext";
import MiniPlayer from "@/components/media/MiniPlayer";
import ParallaxBackground from "@/components/layout/ParallaxBackground";
import dynamic from "next/dynamic";
import { useNotifications } from "@/hooks/useNotifications";
import { ChatPanelProvider, useChatPanel } from "@/contexts/ChatPanelContext";
import ChatPanel from "@/components/chat/ChatPanel";
import { TimerProvider, useTimer } from "@/contexts/TimerContext";
import MiniFocusBar from "@/components/focus/MiniFocusBar";
import { SceneProvider, useScene } from "@/contexts/SceneContext";
import MiniSceneBar from "@/components/scenes/MiniSceneBar";

const YouTubePlayer = dynamic(() => import("@/components/media/YouTubePlayer"), { ssr: false });

function AppShell({ children }: { children: React.ReactNode }) {
  const { currentTrack, play } = usePlayer();
  const { isOpen } = useChatPanel();
  const { status: timerStatus } = useTimer();
  const { activeScene } = useScene();
  const pathname = usePathname();
  const hideVoice = isOpen || pathname === "/chat";
  useNotifications();

  // Handle os:play-youtube events dispatched by the set_media client tool
  const handlePlayYouTube = useCallback(
    (e: Event) => {
      const { videoId, title, thumbnail } = (e as CustomEvent).detail ?? {};
      if (videoId) play({ type: "youtube", videoId, title: title ?? "", thumbnail: thumbnail ?? "" });
    },
    [play],
  );
  useEffect(() => {
    window.addEventListener("os:play-youtube", handlePlayYouTube);
    return () => window.removeEventListener("os:play-youtube", handlePlayYouTube);
  }, [handlePlayYouTube]);
  const hasPlayer = !!currentTrack;
  const hasTimer = timerStatus !== "idle";
  const hasScene = !!activeScene;

  // Stack from bottom: MobileNav(57px) → SceneBar(40px) → FocusBar(44px) → Player(56px)
  let pbMobile = "pb-20";
  let pbDesktop = "md:pb-6";
  if (hasScene && hasTimer && hasPlayer) { pbMobile = "pb-[200px]"; pbDesktop = "md:pb-[152px]"; }
  else if (hasScene && hasTimer)         { pbMobile = "pb-[144px]"; pbDesktop = "md:pb-[96px]"; }
  else if (hasScene && hasPlayer)        { pbMobile = "pb-[176px]"; pbDesktop = "md:pb-[136px]"; }
  else if (hasTimer && hasPlayer)        { pbMobile = "pb-[160px]"; pbDesktop = "md:pb-[112px]"; }
  else if (hasScene)                     { pbMobile = "pb-[100px]"; pbDesktop = "md:pb-[44px]"; }
  else if (hasTimer)                     { pbMobile = "pb-[104px]"; pbDesktop = "md:pb-[56px]"; }
  else if (hasPlayer)                    { pbMobile = "pb-36";      pbDesktop = "md:pb-24"; }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav />
      <div className="flex flex-1 min-h-0">
        <main
          className={`flex-1 overflow-y-auto p-4 md:p-6 transition-all duration-300 ${pbMobile} ${pbDesktop} ${isOpen ? "md:mr-[400px]" : ""}`}
        >
          {children}
        </main>
        <ChatPanel />
      </div>
      <MobileNav />
      {!hideVoice && <VoiceFloatButton />}
      <MiniSceneBar />
      <MiniFocusBar />
      <MiniPlayer />
      <YouTubePlayer />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PlayerProvider>
      <ChatPanelProvider>
        <TimerProvider>
          <SceneProvider>
            <ParallaxBackground />
            <AppShell>{children}</AppShell>
          </SceneProvider>
        </TimerProvider>
      </ChatPanelProvider>
    </PlayerProvider>
  );
}

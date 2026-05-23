"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import TopNav from "@/components/layout/TopNav";
import MobileNav from "@/components/layout/MobileNav";
import QuickLogButton from "@/components/layout/QuickLogButton";
import { PlayerProvider, usePlayer } from "@/contexts/PlayerContext";
import MiniPlayer from "@/components/media/MiniPlayer";
import ParallaxBackground from "@/components/layout/ParallaxBackground";
import dynamic from "next/dynamic";
import { useNotifications } from "@/hooks/useNotifications";
import { ChatPanelProvider, useChatPanel } from "@/contexts/ChatPanelContext";
import ChatPanel from "@/components/chat/ChatPanel";
import { TimerProvider, useTimer } from "@/contexts/TimerContext";
import MiniFocusBar from "@/components/focus/MiniFocusBar";

const YouTubePlayer = dynamic(() => import("@/components/media/YouTubePlayer"), { ssr: false });

function AppShell({ children }: { children: React.ReactNode }) {
  const { currentTrack } = usePlayer();
  const { isOpen } = useChatPanel();
  const { status: timerStatus } = useTimer();
  const pathname = usePathname();
  // Hide the floating quick-log button while chatting — it otherwise covers the
  // chat's send button (slide-in panel) or sits on top of the full chat page.
  const hideQuickLog = isOpen || pathname === "/chat";
  useNotifications();
  const hasPlayer = !!currentTrack;
  const hasTimer = timerStatus !== "idle";

  // Stack: MobileNav(57px) → MiniFocusBar(44px) → MiniPlayer(56px)
  let pbMobile = "pb-20";
  let pbDesktop = "md:pb-6";
  if (hasTimer && hasPlayer) { pbMobile = "pb-[160px]"; pbDesktop = "md:pb-[112px]"; }
  else if (hasTimer)          { pbMobile = "pb-[104px]"; pbDesktop = "md:pb-[56px]"; }
  else if (hasPlayer)         { pbMobile = "pb-36";      pbDesktop = "md:pb-24"; }

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
      {!hideQuickLog && <QuickLogButton />}
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
          <ParallaxBackground />
          <AppShell>{children}</AppShell>
        </TimerProvider>
      </ChatPanelProvider>
    </PlayerProvider>
  );
}

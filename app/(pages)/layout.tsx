"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import TopNav from "@/components/layout/TopNav";
import MobileNav from "@/components/layout/MobileNav";
import QuickLogButton from "@/components/layout/QuickLogButton";
import { PlayerProvider, usePlayer } from "@/contexts/PlayerContext";
import MiniPlayer from "@/components/media/MiniPlayer";
import AnimatedBackground from "@/components/layout/AnimatedBackground";
import dynamic from "next/dynamic";
import { useNotifications } from "@/hooks/useNotifications";

const YouTubePlayer = dynamic(() => import("@/components/media/YouTubePlayer"), { ssr: false });

function AppShell({ children }: { children: React.ReactNode }) {
  const { currentTrack } = usePlayer();
  useNotifications();
  const hasPlayer = !!currentTrack;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav />
      <main className={`flex-1 overflow-y-auto p-4 md:p-6 ${hasPlayer ? "pb-36 md:pb-24" : "pb-20 md:pb-6"}`}>
        {children}
      </main>
      <MobileNav />
      <QuickLogButton />
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
      <AnimatedBackground />
      <AppShell>{children}</AppShell>
    </PlayerProvider>
  );
}

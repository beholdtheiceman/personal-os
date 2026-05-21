"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { RiYoutubeLine, RiMusicLine } from "react-icons/ri";

const YouTubeTab = dynamic(() => import("./YouTubeTab"), { ssr: false });
const SunoTab = dynamic(() => import("./SunoTab"), { ssr: false });

type Tab = "youtube" | "suno";

export default function MediaView() {
  const [tab, setTab] = useState<Tab>("youtube");

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Media Player</h1>
        {/* Tab switcher */}
        <div className="flex items-center gap-0.5 bg-bg-tertiary rounded-xl p-1 border border-bg-border">
          <button
            onClick={() => setTab("youtube")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "youtube"
                ? "bg-accent text-white shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <RiYoutubeLine className="w-4 h-4" /> YouTube
          </button>
          <button
            onClick={() => setTab("suno")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "suno"
                ? "bg-accent text-white shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <RiMusicLine className="w-4 h-4" /> My Music
          </button>
        </div>
      </div>

      <div className="card p-4">
        {tab === "youtube" ? <YouTubeTab /> : <SunoTab />}
      </div>
    </div>
  );
}

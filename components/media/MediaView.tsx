"use client";
import dynamic from "next/dynamic";

const YouTubeTab = dynamic(() => import("./YouTubeTab"), { ssr: false });

export default function MediaView() {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold text-text-primary">Media Player</h1>
      <div className="card p-4">
        <YouTubeTab />
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import MemoryManager from "@/components/memory/MemoryManager";
import SecondBrainSync from "@/components/memory/SecondBrainSync";

type Tab = "memory" | "second-brain";

export default function MemoryPage() {
  const [tab, setTab] = useState<Tab>("memory");

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Tabs */}
      <div className="flex bg-bg-secondary border border-bg-border rounded-xl p-1 gap-1">
        {([
          { id: "memory", label: "Memory" },
          { id: "second-brain", label: "Second Brain" },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === id
                ? "bg-white shadow-sm text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "memory" && <MemoryManager />}
      {tab === "second-brain" && <SecondBrainSync />}
    </div>
  );
}

"use client";
import { useState } from "react";
import WorkoutLogger from "@/components/workout/WorkoutLogger";
import WorkoutHistory from "@/components/workout/WorkoutHistory";
import PRBoard from "@/components/workout/PRBoard";
import WorkoutPlanView from "@/components/workout/WorkoutPlanView";

type Tab = "log" | "history" | "prs" | "plans";

export default function WorkoutPage() {
  const [tab, setTab] = useState<Tab>("log");

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Workout</h1>
        <p className="text-text-secondary text-sm">Log sessions, track PRs, and get AI-generated training plans.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-bg-tertiary rounded-xl w-fit border border-white/[0.12]">
        {([
          { key: "log",     label: "Log" },
          { key: "history", label: "History" },
          { key: "prs",     label: "PRs" },
          { key: "plans",   label: "Plans" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-accent/40 text-white shadow-sm"
                : "bg-white/[0.12] text-text-secondary hover:bg-white/[0.20] hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card">
        {tab === "log"     && <WorkoutLogger />}
        {tab === "history" && <WorkoutHistory />}
        {tab === "prs"     && <PRBoard />}
        {tab === "plans"   && <WorkoutPlanView />}
      </div>
    </div>
  );
}

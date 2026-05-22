"use client";
import { useState } from "react";
import TimeEntryForm from "@/components/time/TimeEntryForm";
import TimeLog from "@/components/time/TimeLog";
import WeeklyTimeChart from "@/components/time/WeeklyTimeChart";
import ProjectBreakdown from "@/components/time/ProjectBreakdown";

type Tab = "today" | "week" | "projects";

export default function TimePage() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Time Tracker</h1>
        <p className="text-text-secondary text-sm">Log what you work on. Focus sessions log here automatically.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-bg-tertiary rounded-xl w-fit border border-white/[0.12]">
        {([
          { key: "today",    label: "Today" },
          { key: "week",     label: "Week" },
          { key: "projects", label: "Projects" },
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

      <div className="card space-y-4">
        {tab === "today" && (
          <>
            <TimeEntryForm />
            <TimeLog />
          </>
        )}
        {tab === "week"     && <WeeklyTimeChart />}
        {tab === "projects" && <ProjectBreakdown />}
      </div>
    </div>
  );
}

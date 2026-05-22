"use client";
import HealthTracker from "@/components/health/HealthTracker";
import HydrationWidget from "@/components/health/HydrationWidget";
import MoodWidget from "@/components/health/MoodWidget";
import BodyMetricsWidget from "@/components/health/BodyMetricsWidget";
import SupplementWidget from "@/components/health/SupplementWidget";

export default function HealthPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Health</h1>
        <p className="text-text-secondary text-sm">Track sleep, energy, exercise, hydration, mood, body metrics, and supplements.</p>
      </div>
      <HealthTracker />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <HydrationWidget />
        <MoodWidget />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SupplementWidget />
        <BodyMetricsWidget />
      </div>
    </div>
  );
}

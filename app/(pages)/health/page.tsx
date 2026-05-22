"use client";
import HealthTracker from "@/components/health/HealthTracker";
import HydrationWidget from "@/components/health/HydrationWidget";

export default function HealthPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Health</h1>
        <p className="text-text-secondary text-sm">Track sleep, energy, exercise, and hydration.</p>
      </div>
      <HealthTracker />
      <HydrationWidget />
    </div>
  );
}

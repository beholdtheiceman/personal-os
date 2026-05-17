"use client";
import HealthTracker from "@/components/health/HealthTracker";

export default function HealthPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Health</h1>
      <p className="text-text-secondary text-sm mb-6">Track sleep, energy, and exercise with weekly trends.</p>
      <HealthTracker />
    </div>
  );
}

"use client";
import GoalsManager from "@/components/goals/GoalsManager";

export default function GoalsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Goals</h1>
      <p className="text-text-secondary text-sm mb-6">Track goals with milestones and AI check-ins.</p>
      <GoalsManager />
    </div>
  );
}

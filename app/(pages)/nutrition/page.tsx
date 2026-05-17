"use client";
import NutritionTracker from "@/components/nutrition/NutritionTracker";

export default function NutritionPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Nutrition</h1>
      <p className="text-text-secondary text-sm mb-6">Log meals and let Claude estimate your macros.</p>
      <NutritionTracker />
    </div>
  );
}

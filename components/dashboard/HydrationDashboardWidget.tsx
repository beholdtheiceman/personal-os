"use client";
import { RiDropLine, RiCheckLine } from "react-icons/ri";
import { useHydration } from "@/hooks/useHydration";
import Link from "next/link";

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function HydrationDashboardWidget() {
  const { glasses, goal, loading, increment } = useHydration();

  if (loading) return null;

  const progress = Math.min(glasses / goal, 1);
  const offset = CIRCUMFERENCE * (1 - progress);
  const goalMet = glasses >= goal;

  return (
    <div className="card flex items-center gap-4">
      {/* Mini ring */}
      <div className="relative shrink-0">
        <svg width="52" height="52" className="-rotate-90">
          <circle cx="26" cy="26" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="5" className="text-bg-tertiary" />
          <circle
            cx="26" cy="26" r={RADIUS}
            fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className={goalMet ? "text-success transition-all duration-500" : "text-info transition-all duration-500"}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {goalMet
            ? <RiCheckLine className="w-3.5 h-3.5 text-success" />
            : <RiDropLine className="w-3.5 h-3.5 text-info" />
          }
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Hydration</p>
        <p className="text-lg font-bold text-text-primary leading-tight">
          {glasses} <span className="text-sm font-normal text-text-muted">/ {goal} glasses</span>
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={increment}
          disabled={goalMet}
          title="Log a glass"
          className="w-8 h-8 rounded-full bg-info/20 hover:bg-info/30 text-info flex items-center justify-center text-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          +
        </button>
        <Link href="/health" className="text-xs text-text-muted hover:text-accent transition-colors">
          Details
        </Link>
      </div>
    </div>
  );
}

"use client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

function getGreeting(name: string | null): string {
  const hour = new Date().getHours();
  const first = name?.split(" ")[0] ?? "there";
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

export default function TopBar() {
  const { user } = useAuth();
  const today = new Date();

  return (
    <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-bg-border bg-bg-secondary shrink-0">
      <div>
        <p className="text-sm font-medium text-text-primary">
          {getGreeting(user?.displayName ?? null)}
        </p>
        <p className="text-xs text-text-secondary">
          {format(today, "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      {/* Right side — future: notifications, settings */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" title="Connected" />
        <span className="text-xs text-text-muted hidden sm:block">Live</span>
      </div>
    </header>
  );
}

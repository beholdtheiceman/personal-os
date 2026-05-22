"use client";
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import LoadingDots from "@/components/ui/LoadingDots";
import { RiRefreshLine, RiArrowDownSLine, RiArrowUpSLine, RiRobot2Line } from "react-icons/ri";
import type { DailyBriefing } from "@/types";

export default function DailyBriefingWidget() {
  const { user } = useAuth();
  // Use device timezone for the date so it matches the cron's computation
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "daily_briefings", today);
    return onSnapshot(ref, (snap) => {
      setBriefing(snap.exists() ? (snap.data() as DailyBriefing) : null);
      setLoading(false);
    });
  }, [user, today]);

  const generate = async () => {
    if (!user) return;
    setGenerating(true);
    setExpanded(true);
    try {
      const idToken = await user.getIdToken();
      await fetch("/api/daily-briefing", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "X-Timezone": tz },
      });
      // onSnapshot will pick up the result
    } catch {
      // silent — onSnapshot won't update, user can retry
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiRobot2Line className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Morning Briefing</h2>
          {briefing && (
            <span className="text-[10px] text-text-muted">
              {format(new Date(briefing.generated_at), "h:mm a")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generate}
            disabled={generating}
            title="Regenerate"
            className="text-text-muted hover:text-accent transition-colors disabled:opacity-40"
          >
            <RiRefreshLine className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
          </button>
          {briefing && (
            <button onClick={() => setExpanded((x) => !x)} className="text-text-muted hover:text-text-secondary">
              {expanded ? <RiArrowUpSLine className="w-4 h-4" /> : <RiArrowDownSLine className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {generating && (
        <div className="py-4 flex justify-center"><LoadingDots /></div>
      )}

      {!generating && !briefing && (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-text-muted">No briefing generated yet today.</p>
          <button onClick={generate} className="btn-primary text-sm px-4 py-1.5">
            Generate morning briefing
          </button>
        </div>
      )}

      {!generating && briefing && !expanded && (
        <div className="flex gap-4 text-xs text-text-muted">
          {briefing.tasks_flagged > 0 && <span>{briefing.tasks_flagged} priority tasks</span>}
          {briefing.habits_due > 0 && <span>{briefing.habits_due} habits due</span>}
          {briefing.calendar_events > 0 && <span>{briefing.calendar_events} calendar events</span>}
          <button onClick={() => setExpanded(true)} className="text-accent hover:text-accent-text ml-auto">
            Read →
          </button>
        </div>
      )}

      {!generating && briefing && expanded && (
        <div className="prose-dark text-sm border-t border-bg-border pt-3">
          <ReactMarkdown>{briefing.content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

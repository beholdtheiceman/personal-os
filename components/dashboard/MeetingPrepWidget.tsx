"use client";
import { useState, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { format, parseISO, differenceInMinutes } from "date-fns";
import ReactMarkdown from "react-markdown";
import { RiRefreshLine, RiArrowDownSLine, RiArrowUpSLine, RiCalendarEventLine } from "react-icons/ri";

interface MeetingPrep {
  eventId: string;
  eventTitle: string;
  eventStart: string;
  eventEnd: string;
  content: string;
  generated_at: string;
  post_meeting_prompted: boolean;
}

export default function MeetingPrepWidget() {
  const { user } = useAuth();
  const [preps, setPreps] = useState<MeetingPrep[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "meeting_preps"),
      orderBy("eventStart", "asc"),
      limit(5),
    );
    return onSnapshot(q, (snap) => {
      const now = new Date();
      const upcoming = snap.docs
        .map((d) => ({ eventId: d.id, ...d.data() } as MeetingPrep))
        .filter((p) => new Date(p.eventEnd) > now);
      setPreps(upcoming);
      if (upcoming.length > 0 && !expanded) setExpanded(upcoming[0].eventId);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const idToken = await user.getIdToken();
      await fetch("/api/meeting-prep", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
    } catch {
      // silent — onSnapshot picks up any new docs
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    const onRefresh = (e: Event) => {
      if ((e as CustomEvent).detail?.widget === "meeting-prep") void refresh();
    };
    window.addEventListener("os:refresh-widget", onRefresh);
    return () => window.removeEventListener("os:refresh-widget", onRefresh);
  }, [refresh]);

  function countdown(start: string) {
    const mins = differenceInMinutes(parseISO(start), new Date());
    if (mins < 0) return "in progress";
    if (mins < 60) return `in ${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
          <RiCalendarEventLine className="w-3.5 h-3.5" /> Meeting Prep
        </h2>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-xs text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
          title="Refresh briefings"
        >
          <RiRefreshLine className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-text-muted text-center py-4">Loading...</p>
      ) : preps.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4">No upcoming meeting briefings</p>
      ) : (
        <div className="space-y-2">
          {preps.map((prep) => {
            const isOpen = expanded === prep.eventId;
            const startTime = format(parseISO(prep.eventStart), "h:mm a");
            return (
              <div key={prep.eventId} className="border border-bg-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : prep.eventId)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-bg-tertiary transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{prep.eventTitle}</p>
                    <p className="text-xs text-text-muted">
                      {startTime} · <span className="text-accent">{countdown(prep.eventStart)}</span>
                    </p>
                  </div>
                  {isOpen ? (
                    <RiArrowUpSLine className="w-4 h-4 text-text-muted shrink-0 ml-2" />
                  ) : (
                    <RiArrowDownSLine className="w-4 h-4 text-text-muted shrink-0 ml-2" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 border-t border-bg-border">
                    <div className="mt-2 prose prose-sm prose-invert max-w-none text-xs leading-relaxed">
                      <ReactMarkdown>{prep.content}</ReactMarkdown>
                    </div>
                    <p className="text-xs text-text-muted mt-2">
                      Generated {format(parseISO(prep.generated_at), "h:mm a")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

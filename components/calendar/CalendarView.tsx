"use client";
// Google Calendar view — OAuth connect + 7-day event list
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { RiCalendarLine, RiLinkM, RiRefreshLine, RiMapPinLine, RiTimeLine } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import toast from "react-hot-toast";

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  allDay: boolean;
}

function dayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEEE, MMM d");
}

function groupByDay(events: CalEvent[]) {
  const groups: Record<string, CalEvent[]> = {};
  for (const e of events) {
    const key = e.start.split("T")[0]; // "YYYY-MM-DD"
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }
  return groups;
}

export default function CalendarView() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null); // null = loading
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/calendar/events?uid=${user.uid}`);
      const data = await res.json();
      setConnected(data.connected);
      setEvents(data.events ?? []);
    } catch (err) {
      console.error("Calendar fetch error:", err);
      toast.error("Failed to load calendar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Check for ?connected=true or ?error=... in URL after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast.success("Google Calendar connected!");
      window.history.replaceState({}, "", "/calendar");
      fetchEvents();
    } else if (params.get("error")) {
      toast.error("Calendar connection failed. Try again.");
      window.history.replaceState({}, "", "/calendar");
    }
  }, [fetchEvents]);

  const handleConnect = () => {
    if (!user) return;
    window.location.href = `/api/calendar/auth?uid=${user.uid}`;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEvents();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingDots />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Calendar</h1>
          <p className="text-xs text-text-secondary mt-0.5">Next 7 days</p>
        </div>
        {connected && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="btn-ghost flex items-center gap-2 text-sm"
            >
              {refreshing ? <LoadingDots /> : <><RiRefreshLine className="w-4 h-4" /> Refresh</>}
            </button>
            <button
              onClick={handleConnect}
              className="btn-ghost flex items-center gap-2 text-sm text-text-muted"
              title="Re-authorize to update permissions"
            >
              <RiLinkM className="w-4 h-4" /> Reconnect
            </button>
          </div>
        )}
      </div>

      {/* Not connected state */}
      {!connected && (
        <div className="card flex flex-col items-center py-14 text-center">
          <RiCalendarLine className="w-12 h-12 text-text-muted mb-4" />
          <h2 className="text-base font-semibold text-text-primary mb-2">Connect Google Calendar</h2>
          <p className="text-sm text-text-secondary mb-6 max-w-xs">
            See your upcoming events here and have them injected into your daily AI report.
          </p>
          <button onClick={handleConnect} className="btn-primary flex items-center gap-2">
            <RiLinkM className="w-4 h-4" /> Connect Google Calendar
          </button>
          <p className="text-xs text-text-muted mt-4">
            Requires GOOGLE_CALENDAR_CLIENT_ID + CLIENT_SECRET in .env.local
          </p>
        </div>
      )}

      {/* Connected + no events */}
      {connected && events.length === 0 && (
        <div className="card text-center py-12">
          <RiCalendarLine className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary text-sm">No events in the next 7 days.</p>
        </div>
      )}

      {/* Events grouped by day */}
      {connected && events.length > 0 && (
        <div className="space-y-4">
          {Object.entries(groupByDay(events)).map(([day, dayEvents]) => (
            <div key={day}>
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">
                {dayLabel(day)}
              </h3>
              <div className="space-y-2">
                {dayEvents.map((event) => (
                  <div key={event.id} className="card hover:border-accent/30 transition-colors">
                    <p className="text-sm font-medium text-text-primary">{event.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {!event.allDay && (
                        <span className="flex items-center gap-1 text-xs text-text-secondary">
                          <RiTimeLine className="w-3.5 h-3.5" />
                          {format(parseISO(event.start), "h:mm a")}
                          {" – "}
                          {format(parseISO(event.end), "h:mm a")}
                        </span>
                      )}
                      {event.allDay && (
                        <span className="text-xs text-text-muted">All day</span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                          <RiMapPinLine className="w-3.5 h-3.5" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

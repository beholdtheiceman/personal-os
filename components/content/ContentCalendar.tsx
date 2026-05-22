"use client";
import { useState } from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";
import type { PodcastEpisode } from "@/types";

interface CalendarEvent {
  episode: PodcastEpisode;
  type: "record" | "publish";
}

interface Props {
  episodes: PodcastEpisode[];
  onEdit: (episode: PodcastEpisode) => void;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

export default function ContentCalendar({ episodes, onEdit }: Props) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  // Build a map: "YYYY-MM-DD" → CalendarEvent[]
  const eventMap = new Map<string, CalendarEvent[]>();
  for (const ep of episodes) {
    if (ep.record_date) {
      const list = eventMap.get(ep.record_date) ?? [];
      list.push({ episode: ep, type: "record" });
      eventMap.set(ep.record_date, list);
    }
    if (ep.publish_date) {
      const list = eventMap.get(ep.publish_date) ?? [];
      list.push({ episode: ep, type: "publish" });
      eventMap.set(ep.publish_date, list);
    }
  }

  const daysInMonth  = getDaysInMonth(year, month);
  const firstDayOfWk = getFirstDayOfMonth(year, month);
  const totalCells   = Math.ceil((firstDayOfWk + daysInMonth) / 7) * 7;

  const monthLabel = new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });
  const todayStr   = today.toLocaleDateString("en-CA");

  const cells: (number | null)[] = [
    ...Array(firstDayOfWk).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(totalCells - firstDayOfWk - daysInMonth).fill(null),
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="btn-ghost p-1"><RiArrowLeftSLine className="w-5 h-5" /></button>
        <span className="text-sm font-semibold text-text-primary">{monthLabel}</span>
        <button onClick={nextMonth} className="btn-ghost p-1"><RiArrowRightSLine className="w-5 h-5" /></button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500/40 inline-block" /> Record
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500/40 inline-block" /> Publish
        </span>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 text-center">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} className="text-xs text-text-muted py-1 font-medium">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="h-16 rounded-md" />;

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const events  = eventMap.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;

          return (
            <div
              key={idx}
              className={`h-16 rounded-md p-1 text-xs border ${
                isToday ? "border-accent bg-accent/5" : "border-bg-border bg-bg-secondary"
              } flex flex-col overflow-hidden`}
            >
              <span className={`font-medium mb-0.5 ${isToday ? "text-accent" : "text-text-secondary"}`}>{day}</span>
              <div className="space-y-0.5 overflow-hidden">
                {events.slice(0, 2).map((ev, i) => (
                  <button
                    key={i}
                    onClick={() => onEdit(ev.episode)}
                    title={`${ev.type === "record" ? "🎙 Record" : "📢 Publish"}: ${ev.episode.title}`}
                    className={`w-full text-left truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                      ev.type === "record"
                        ? "bg-yellow-500/20 text-yellow-300"
                        : "bg-green-500/20 text-green-300"
                    }`}
                  >
                    {ev.episode.title}
                  </button>
                ))}
                {events.length > 2 && (
                  <span className="text-[10px] text-text-muted px-1">+{events.length - 2} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

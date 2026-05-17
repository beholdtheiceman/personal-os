"use client";
import { format, subDays } from "date-fns";
import type { HealthLog } from "@/types";

interface Props {
  logs: HealthLog[];
}

const METRICS = [
  { key: "sleep_hours" as keyof HealthLog, label: "Sleep", color: "#818cf8", max: 12 },
  { key: "sleep_quality" as keyof HealthLog, label: "Sleep Quality", color: "#34d399", max: 10 },
  { key: "energy_level" as keyof HealthLog, label: "Energy", color: "#fbbf24", max: 10 },
];

const W = 560;
const H = 160;
const PAD = { top: 16, right: 16, bottom: 28, left: 32 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

export default function WeeklyChart({ logs }: Props) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i));
  const logMap = new Map(logs.map((l) => [l.date, l]));

  const xForIndex = (i: number) => PAD.left + (i / 6) * INNER_W;

  const yForValue = (value: number, max: number) =>
    PAD.top + INNER_H - (value / max) * INNER_H;

  return (
    <div className="card space-y-3">
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">7-Day Trends</h2>
      <div className="flex gap-4 text-xs flex-wrap">
        {METRICS.map((m) => (
          <span key={m.key} className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: m.color }} />
            <span className="text-text-muted">{m.label}</span>
          </span>
        ))}
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = PAD.top + INNER_H * (1 - t);
            return (
              <line
                key={t}
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
            );
          })}

          {/* Lines per metric */}
          {METRICS.map((m) => {
            const points: [number, number][] = days.map((d, i) => {
              const dateStr = format(d, "yyyy-MM-dd");
              const log = logMap.get(dateStr);
              const value = log ? (log[m.key] as number) : null;
              return [xForIndex(i), value !== null ? yForValue(value, m.max) : -1];
            });

            const pathD = points
              .filter(([, y]) => y >= 0)
              .reduce((acc, [x, y], idx) => {
                if (idx === 0) return `M ${x} ${y}`;
                return acc + ` L ${x} ${y}`;
              }, "");

            return (
              <g key={m.key as string}>
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={m.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.85}
                  />
                )}
                {points.map(([x, y], i) =>
                  y >= 0 ? (
                    <circle key={i} cx={x} cy={y} r={3} fill={m.color} opacity={0.9} />
                  ) : null
                )}
              </g>
            );
          })}

          {/* Day labels */}
          {days.map((d, i) => (
            <text
              key={i}
              x={xForIndex(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize={10}
              fill="rgba(255,255,255,0.3)"
            >
              {format(d, "EEE")}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

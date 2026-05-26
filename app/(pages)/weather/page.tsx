"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { RiSunLine, RiArrowRightSLine } from "react-icons/ri";
import { wmoEmoji, uvLabel } from "@/lib/weather";
import type { WeatherResponse } from "@/types";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function formatHour(iso: string) {
  const h = parseInt(iso.slice(11, 13), 10);
  if (h === 0)  return "12 AM";
  if (h < 12)   return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

export default function WeatherPage() {
  const { user } = useAuth();
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [noLocation, setNoLocation] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/weather", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 400) { setNoLocation(true); return; }
        if (!res.ok) return;
        setWeather(await res.json());
      } catch {
        // silently skip
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />
        <div className="h-40 bg-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (noLocation) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center space-y-3 py-10">
          <span className="text-4xl">🌍</span>
          <p className="text-text-primary font-medium">No location configured</p>
          <p className="text-sm text-text-muted">
            Go to{" "}
            <Link href="/settings" className="text-accent hover:underline">Settings</Link>{" "}
            and detect your location to enable weather.
          </p>
        </div>
      </div>
    );
  }

  if (!weather) return null;

  const { current, hourly, daily, city, units } = weather;
  const deg = units === "celsius" ? "°C" : "°F";
  const windUnit = units === "fahrenheit" ? "mph" : "km/h";
  const uv = uvLabel(current.uv_index);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-2">
        <RiSunLine className="w-5 h-5 text-accent" />
        <h1 className="text-xl font-semibold text-text-primary">Weather</h1>
        <RiArrowRightSLine className="w-4 h-4 text-text-muted" />
        <span className="text-sm text-text-muted">{city}</span>
      </div>

      {/* Current conditions */}
      <div className="card space-y-4">
        <div className="flex items-start gap-4">
          <span className="text-6xl">{wmoEmoji(current.weather_code)}</span>
          <div className="flex-1">
            <p className="text-5xl font-bold text-text-primary">{current.temp}{deg}</p>
            <p className="text-lg text-text-secondary mt-1">{current.condition}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10">
          <Stat label="Feels like"  value={`${current.feels_like}${deg}`} />
          <Stat label="Humidity"    value={`${current.humidity}%`} />
          <Stat label="Wind"        value={`${current.wind_speed} ${windUnit}`} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">UV Index</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-text-primary">{current.uv_index}</span>
              <span className="text-xs font-medium" style={{ color: uv.color }}>{uv.label}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 mt-1">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(current.uv_index / 11 * 100, 100)}%`, background: uv.color }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hourly scroll */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Today — Hourly</h2>
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="flex gap-3 pb-1" style={{ minWidth: "max-content" }}>
            {hourly.map((h) => (
              <div
                key={h.time}
                className="flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg bg-white/5 min-w-[56px]"
              >
                <span className="text-[10px] text-text-muted font-medium">{formatHour(h.time)}</span>
                <span className="text-lg">{wmoEmoji(h.weather_code)}</span>
                <span className="text-sm font-semibold text-text-primary">{h.temp}{deg}</span>
                {h.precip_probability > 0 && (
                  <span className="text-[10px] text-blue-400">{h.precip_probability}%</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 7-day forecast */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">7-Day Forecast</h2>
        <div className="space-y-1">
          {daily.map((day, i) => {
            const d = new Date(day.date + "T12:00:00");
            const label = i === 0 ? "Today"
              : i === 1 ? "Tomorrow"
              : `${DAY_ABBR[d.getDay()]}, ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
            const dayUv = uvLabel(day.uv_index_max);
            return (
              <div
                key={day.date}
                className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
              >
                <span className="text-xs text-text-secondary font-medium w-28 shrink-0">{label}</span>
                <span className="text-xl">{wmoEmoji(day.weather_code)}</span>
                <span className="text-xs text-text-secondary flex-1">{day.condition}</span>
                {day.precip_sum > 0 && (
                  <span className="text-[10px] text-blue-400 shrink-0">
                    {units === "fahrenheit" ? `${day.precip_sum}"` : `${day.precip_sum}mm`}
                  </span>
                )}
                <span className="text-[10px] shrink-0" style={{ color: dayUv.color }}>UV {day.uv_index_max}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm font-semibold text-text-primary">{day.temp_max}{deg}</span>
                  <span className="text-xs text-text-muted">/</span>
                  <span className="text-xs text-text-muted">{day.temp_min}{deg}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-text-muted font-medium">{label}</span>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

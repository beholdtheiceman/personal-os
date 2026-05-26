"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { RiSunLine } from "react-icons/ri";
import { wmoEmoji } from "@/lib/weather";
import type { WeatherResponse } from "@/types";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WeatherWidget() {
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

  if (loading) return null;

  const deg = weather?.units === "celsius" ? "°C" : "°F";

  if (noLocation) {
    return (
      <div className="card space-y-2">
        <div className="flex items-center gap-2">
          <RiSunLine className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Weather</h2>
        </div>
        <p className="text-xs text-text-muted">
          Set your location in{" "}
          <Link href="/settings" className="text-accent hover:underline">Settings</Link>{" "}
          to see weather.
        </p>
      </div>
    );
  }

  if (!weather) return null;

  const { current, daily, city } = weather;
  const today = daily[0];

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiSunLine className="w-4 h-4 text-accent" />
          <Link href="/weather" className="text-sm font-semibold text-text-primary hover:text-accent transition-colors">
            Weather
          </Link>
        </div>
        <span className="text-xs text-text-muted truncate max-w-[120px]">{city}</span>
      </div>

      {/* Current */}
      <div className="flex items-end gap-3">
        <span className="text-4xl">{wmoEmoji(current.weather_code)}</span>
        <div>
          <p className="text-3xl font-bold text-text-primary leading-none">
            {current.temp}{deg}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">{current.condition}</p>
        </div>
        <div className="ml-auto text-right text-xs text-text-muted space-y-0.5">
          <p>Feels {current.feels_like}{deg}</p>
          <p>H:{today.temp_max}{deg} L:{today.temp_min}{deg}</p>
        </div>
      </div>

      {/* 5-day strip */}
      <div className="grid grid-cols-5 gap-1 pt-1 border-t border-white/10">
        {daily.slice(0, 5).map((day) => {
          const d = new Date(day.date + "T12:00:00");
          const label = d.toDateString() === new Date().toDateString() ? "Today" : DAY_ABBR[d.getDay()];
          return (
            <div key={day.date} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-text-muted font-medium">{label}</span>
              <span className="text-sm">{wmoEmoji(day.weather_code)}</span>
              <span className="text-[10px] text-text-primary font-medium">{day.temp_max}{deg}</span>
              <span className="text-[10px] text-text-muted">{day.temp_min}{deg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

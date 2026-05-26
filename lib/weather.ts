/**
 * Weather utilities — Open-Meteo (free, no API key).
 * Used by /api/weather and /api/daily-briefing.
 */

import type { WeatherResponse, WeatherHourly, WeatherDay } from "@/types";

// ── WMO weather code map ──────────────────────────────────────────────────────

export const WMO_CONDITIONS: Record<number, string> = {
  0:  "Clear Sky",
  1:  "Mostly Clear",
  2:  "Partly Cloudy",
  3:  "Overcast",
  45: "Foggy",
  48: "Icy Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  56: "Freezing Drizzle",
  57: "Heavy Freezing Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Freezing Rain",
  67: "Heavy Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Light Showers",
  81: "Showers",
  82: "Heavy Showers",
  85: "Snow Showers",
  86: "Heavy Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ Hail",
  99: "Thunderstorm w/ Heavy Hail",
};

export const WMO_EMOJI: Record<number, string> = {
  0:  "☀️",
  1:  "🌤️",
  2:  "⛅",
  3:  "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌧️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌨️",
  67: "🌨️",
  71: "❄️",
  73: "❄️",
  75: "❄️",
  77: "❄️",
  80: "🌦️",
  81: "🌧️",
  82: "⛈️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

export function wmoCondition(code: number): string {
  return WMO_CONDITIONS[code] ?? "Unknown";
}

export function wmoEmoji(code: number): string {
  return WMO_EMOJI[code] ?? "🌡️";
}

// ── UV index label ────────────────────────────────────────────────────────────

export function uvLabel(uv: number): { label: string; color: string } {
  if (uv < 3)  return { label: "Low",       color: "#22c55e" };
  if (uv < 6)  return { label: "Moderate",  color: "#eab308" };
  if (uv < 8)  return { label: "High",      color: "#f97316" };
  if (uv < 11) return { label: "Very High", color: "#ef4444" };
  return              { label: "Extreme",   color: "#a855f7" };
}

// ── URL builder ───────────────────────────────────────────────────────────────

export function buildOpenMeteoUrl(
  lat: number,
  lon: number,
  units: "fahrenheit" | "celsius"
): string {
  const windUnit   = units === "fahrenheit" ? "mph" : "kmh";
  const precipUnit = units === "fahrenheit" ? "inch" : "mm";
  return (
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,uv_index` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,uv_index_max` +
    `&forecast_days=7` +
    `&temperature_unit=${units}` +
    `&wind_speed_unit=${windUnit}` +
    `&precipitation_unit=${precipUnit}` +
    `&timezone=auto`
  );
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function fetchWeatherData(
  lat: number,
  lon: number,
  units: "fahrenheit" | "celsius",
  city: string
): Promise<WeatherResponse> {
  const url = buildOpenMeteoUrl(lat, lon, units);
  const res = await fetch(url, { next: { revalidate: 1800 } }); // 30-min cache
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = await res.json();

  // Current conditions
  const c = data.current;
  const current = {
    temp:         Math.round(c.temperature_2m),
    feels_like:   Math.round(c.apparent_temperature),
    humidity:     Math.round(c.relative_humidity_2m),
    wind_speed:   Math.round(c.wind_speed_10m),
    weather_code: c.weather_code as number,
    condition:    wmoCondition(c.weather_code),
    uv_index:     Math.round(c.uv_index ?? 0),
  };

  // Hourly slice starting at the current hour
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const currentHourISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
  const startIdx = (data.hourly.time as string[]).findIndex((t) => t >= currentHourISO);
  const s = startIdx < 0 ? 0 : startIdx;

  const hourly: WeatherHourly[] = (data.hourly.time as string[])
    .slice(s, s + 24)
    .map((time, i) => ({
      time,
      temp:               Math.round(data.hourly.temperature_2m[s + i]),
      weather_code:       data.hourly.weather_code[s + i] as number,
      condition:          wmoCondition(data.hourly.weather_code[s + i]),
      precip_probability: (data.hourly.precipitation_probability[s + i] as number) ?? 0,
    }));

  const daily: WeatherDay[] = (data.daily.time as string[]).map((date, i) => ({
    date,
    weather_code: data.daily.weather_code[i] as number,
    condition:    wmoCondition(data.daily.weather_code[i]),
    temp_max:     Math.round(data.daily.temperature_2m_max[i]),
    temp_min:     Math.round(data.daily.temperature_2m_min[i]),
    precip_sum:   Math.round((data.daily.precipitation_sum[i] ?? 0) * 100) / 100,
    uv_index_max: Math.round(data.daily.uv_index_max[i] ?? 0),
  }));

  return { city, units, current, hourly, daily, fetched_at: new Date().toISOString() };
}

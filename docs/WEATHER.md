# Weather Integration — Implementation Guide

## Overview

Live weather data wired into the app: current conditions on the dashboard, a 7-day forecast page, and weather awareness injected into the AI's context so it can factor weather into recommendations (morning briefing, workout suggestions, etc.).

**Estimated effort:** 1 day  
**Dependencies:** None  
**API:** Open-Meteo (free, no key required) for weather data + Nominatim/browser geolocation for coordinates  
**Alternative:** OpenWeatherMap (free tier: 1,000 calls/day — better if you want alerts)

---

## Why Open-Meteo First

- Completely free, no API key, no rate limit concerns
- Returns hourly + daily forecasts, precipitation, UV index, wind
- Good enough for everything except severe weather push alerts
- If you later want push alerts for storms/freeze warnings, add OpenWeatherMap One Call API alongside it (free tier is sufficient)

---

## Step 1: Location Setup

Users set their home location in Settings (city name or ZIP). Store in Firestore so the server can fetch weather without browser geolocation on every request.

### Settings fields:
```ts
// users/{uid}/settings/preferences
{
  weather_lat: number;
  weather_lon: number;
  weather_location_name: string; // "Nashville, TN"
  weather_units: "fahrenheit" | "celsius"; // default: fahrenheit
}
```

### Location picker in Settings:
Use browser `navigator.geolocation` to auto-detect on first setup, then reverse-geocode with Nominatim (free OpenStreetMap geocoder):

```ts
// lib/geocode.ts
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: { "User-Agent": "personal-os/1.0" } }
  );
  const data = await res.json();
  return data.address?.city || data.address?.town || data.display_name || "Unknown";
}

export async function geocodeCity(query: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
    { headers: { "User-Agent": "personal-os/1.0" } }
  );
  const data = await res.json();
  if (!data[0]) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), name: data[0].display_name };
}
```

---

## Step 2: Weather API Endpoint

### `app/api/weather/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  const { uid } = await getAdminAuth().verifyIdToken(token!);
  const db = getAdminDb();

  // Get user's location from settings
  const settingsDoc = await db.collection("users").doc(uid)
    .collection("settings").doc("preferences").get();
  const { weather_lat, weather_lon, weather_units = "fahrenheit" } = settingsDoc.data() || {};

  if (!weather_lat || !weather_lon) {
    return NextResponse.json({ error: "Location not set" }, { status: 400 });
  }

  const tempUnit = weather_units === "fahrenheit" ? "fahrenheit" : "celsius";

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", weather_lat);
  url.searchParams.set("longitude", weather_lon);
  url.searchParams.set("temperature_unit", tempUnit);
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("current", [
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "weather_code",
    "wind_speed_10m",
    "precipitation",
    "uv_index",
    "cloud_cover",
  ].join(","));
  url.searchParams.set("daily", [
    "temperature_2m_max",
    "temperature_2m_min",
    "weather_code",
    "precipitation_probability_max",
    "uv_index_max",
    "sunrise",
    "sunset",
    "wind_speed_10m_max",
  ].join(","));
  url.searchParams.set("hourly", [
    "temperature_2m",
    "precipitation_probability",
    "weather_code",
  ].join(","));
  url.searchParams.set("forecast_days", "7");

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } }); // 30-min cache
  const data = await res.json();

  return NextResponse.json({
    current: formatCurrent(data.current, data.current_units),
    daily: formatDaily(data.daily),
    hourly: formatHourly(data.hourly),
    location: settingsDoc.data()?.weather_location_name || "Your location",
  });
}

function weatherCodeToCondition(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear", emoji: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if (code <= 49) return { label: "Foggy", emoji: "🌫️" };
  if (code <= 59) return { label: "Drizzle", emoji: "🌦️" };
  if (code <= 69) return { label: "Rain", emoji: "🌧️" };
  if (code <= 79) return { label: "Snow", emoji: "❄️" };
  if (code <= 82) return { label: "Rain showers", emoji: "🌧️" };
  if (code <= 86) return { label: "Snow showers", emoji: "🌨️" };
  if (code <= 99) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "Unknown", emoji: "🌡️" };
}

function formatCurrent(current: any, units: any) {
  const condition = weatherCodeToCondition(current.weather_code);
  return {
    temp: Math.round(current.temperature_2m),
    feels_like: Math.round(current.apparent_temperature),
    humidity: current.relative_humidity_2m,
    wind_speed: Math.round(current.wind_speed_10m),
    precipitation: current.precipitation,
    uv_index: current.uv_index,
    cloud_cover: current.cloud_cover,
    condition: condition.label,
    emoji: condition.emoji,
    unit: units?.temperature_2m || "°F",
  };
}

function formatDaily(daily: any) {
  return daily.time.map((date: string, i: number) => ({
    date,
    high: Math.round(daily.temperature_2m_max[i]),
    low: Math.round(daily.temperature_2m_min[i]),
    condition: weatherCodeToCondition(daily.weather_code[i]),
    precipitation_chance: daily.precipitation_probability_max[i],
    uv_max: daily.uv_index_max[i],
    sunrise: daily.sunrise[i],
    sunset: daily.sunset[i],
    wind_max: Math.round(daily.wind_speed_10m_max[i]),
  }));
}

function formatHourly(hourly: any) {
  // Return next 24 hours only
  return hourly.time.slice(0, 24).map((time: string, i: number) => ({
    time,
    temp: Math.round(hourly.temperature_2m[i]),
    precipitation_chance: hourly.precipitation_probability[i],
    condition: weatherCodeToCondition(hourly.weather_code[i]),
  }));
}
```

---

## Step 3: Dashboard Widget

A compact weather card showing current conditions + today's high/low + tomorrow's outlook:

```tsx
// components/dashboard/WeatherWidget.tsx
"use client";
import { useWeather } from "@/hooks/useWeather";

export function WeatherWidget() {
  const { data, loading } = useWeather();

  if (loading) return <WidgetSkeleton />;
  if (!data) return <LocationPrompt />;

  const { current, daily, location } = data;
  const today = daily[0];
  const tomorrow = daily[1];

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-text-secondary">{location}</p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-4xl font-light">{current.temp}°</span>
            <span className="text-2xl mb-1">{current.emoji}</span>
          </div>
          <p className="text-sm text-text-secondary">{current.condition}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            Feels {current.feels_like}° · H:{today.high}° L:{today.low}°
          </p>
        </div>
        <div className="text-right text-xs text-text-secondary space-y-1">
          <p>💧 {current.humidity}%</p>
          <p>💨 {current.wind_speed} mph</p>
          {current.uv_index >= 6 && <p>☀️ UV {current.uv_index}</p>}
          {today.precipitation_chance >= 30 && (
            <p>🌧 {today.precipitation_chance}% rain</p>
          )}
        </div>
      </div>

      {/* 5-day strip */}
      <div className="flex gap-2 mt-4 overflow-x-auto">
        {daily.slice(1, 6).map((day: any) => (
          <div key={day.date} className="flex-shrink-0 text-center text-xs space-y-1">
            <p className="text-text-secondary">
              {new Date(day.date).toLocaleDateString("en", { weekday: "short" })}
            </p>
            <p className="text-lg">{day.condition.emoji}</p>
            <p>{day.high}°</p>
            <p className="text-text-secondary">{day.low}°</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Step 4: `/weather` Full Page

- Current conditions (large card)
- Hourly scroll (next 24 hours, horizontal)
- 7-day forecast grid
- Sunrise / sunset times
- UV index + outdoor activity advisory (Claude generates this: "UV is 8 today — wear sunscreen if running outside")

---

## Step 5: AI Integration

Inject current weather into the morning briefing system prompt:

```ts
// In the morning briefing cron / chat context builder:
const weather = await getWeatherForUser(uid);
const weatherContext = weather
  ? `Current weather in ${weather.location}: ${weather.current.temp}°${weather.current.unit}, ${weather.current.condition}. ` +
    `Today: high ${weather.daily[0].high}°, low ${weather.daily[0].low}°, ` +
    `${weather.daily[0].precipitation_chance}% chance of rain.`
  : "";

// Inject into system prompt or morning briefing prompt
```

This lets Claude naturally say things like "It's going to rain this afternoon — might want to do your run this morning" without any extra logic.

---

## Step 6: Chat Tools

```ts
{ 
  name: "get_weather", 
  description: "Get current weather and forecast",
  input_schema: { 
    type: "object", 
    properties: { 
      days: { type: "number", description: "Number of forecast days (1-7)" } 
    } 
  } 
},
```

---

## Step 7: Weather Push Notifications (Optional, Phase 2)

If you add OpenWeatherMap One Call API later, you can enable:
- Morning frost warning ("Roads may be icy")
- Afternoon thunderstorm alert ("Storms arriving at 3pm")
- Heat advisory ("UV index 10 today — high sun exposure risk")

Add a `weather_alerts` category to `NotificationSettings`. Threshold logic lives in the daily notification cron.

---

## Cost

- **Open-Meteo** — completely free, no key
- **Nominatim** — completely free, 1 request/second limit (fine for setup)
- **Total cost: $0**

---

## Suggested Build Order

1. Settings location picker (lat/lon → Firestore)
2. `/api/weather` endpoint with Open-Meteo
3. Dashboard widget
4. Weather injected into morning briefing prompt
5. `/weather` full page
6. Chat tool
7. Push alert notifications (optional, needs OpenWeatherMap)

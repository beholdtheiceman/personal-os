import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { fetchWeatherData } from "@/lib/weather";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      uid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settingsSnap = await getAdminDb().doc(`users/${uid}/settings/weather`).get();
    if (!settingsSnap.exists) {
      return NextResponse.json({ error: "Weather location not configured" }, { status: 400 });
    }

    const { latitude, longitude, city, units } = settingsSnap.data() as {
      latitude: number;
      longitude: number;
      city: string;
      units: "fahrenheit" | "celsius";
    };

    const result = await fetchWeatherData(latitude, longitude, units ?? "fahrenheit", city);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/weather]", err);
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 502 });
  }
}

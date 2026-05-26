"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RiSunLine, RiMapPinLine } from "react-icons/ri";
import toast from "react-hot-toast";

export default function WeatherSettings() {
  const { user } = useAuth();
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [city, setCity] = useState("");
  const [units, setUnits] = useState<"fahrenheit" | "celsius">("fahrenheit");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, `users/${user.uid}/settings/weather`)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setLat(d.latitude);
        setLon(d.longitude);
        setCity(d.city ?? "");
        setUnits(d.units ?? "fahrenheit");
      }
    });
  }, [user]);

  const detect = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "User-Agent": "PersonalOS/1.0" } }
          );
          const data = await res.json();
          const a = data.address ?? {};
          const cityName =
            a.city ?? a.town ?? a.village ?? a.county ?? a.state ?? "Unknown";
          const state = a.state_code ?? a.state ?? "";
          setLat(latitude);
          setLon(longitude);
          setCity(state ? `${cityName}, ${state}` : cityName);
        } catch {
          toast.error("Could not reverse-geocode location");
        } finally {
          setLocating(false);
        }
      },
      () => {
        toast.error("Location access denied");
        setLocating(false);
      }
    );
  };

  const save = async () => {
    if (!user || lat === null || lon === null) {
      toast.error("Detect your location first");
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, `users/${user.uid}/settings/weather`),
        { latitude: lat, longitude: lon, city, units, updated_at: new Date().toISOString() },
        { merge: true }
      );
      toast.success("Weather settings saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <RiSunLine className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-text-primary">Weather</h2>
      </div>

      <div className="space-y-4">
        {/* Location */}
        <div>
          <p className="label mb-1.5">Home location</p>
          <div className="flex items-center gap-2">
            <button
              onClick={detect}
              disabled={locating}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <RiMapPinLine className="w-4 h-4" />
              {locating ? "Detecting…" : "Detect my location"}
            </button>
            {city && (
              <span className="text-sm text-text-secondary font-mono">{city}</span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-1.5">
            Uses browser geolocation + Nominatim reverse geocode. Coordinates stored in your
            account — never shared externally.
          </p>
        </div>

        {/* Units toggle */}
        <div>
          <p className="label mb-1.5">Temperature units</p>
          <div className="flex gap-2">
            {(["fahrenheit", "celsius"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnits(u)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  units === u
                    ? "bg-accent/20 text-accent border-accent/40"
                    : "text-text-secondary border-white/10 hover:bg-white/10"
                }`}
              >
                {u === "fahrenheit" ? "°F" : "°C"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving || lat === null} className="btn-primary text-sm w-full">
        {saving ? "Saving…" : "Save Weather Settings"}
      </button>
    </div>
  );
}

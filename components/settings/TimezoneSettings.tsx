"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RiGlobalLine } from "react-icons/ri";
import toast from "react-hot-toast";

// Common timezones offered as the "home" override
const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function tzLabel(tz: string) {
  try {
    const offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? "";
    return `${tz.replace(/_/g, " ")} (${offset})`;
  } catch {
    return tz;
  }
}

export default function TimezoneSettings() {
  const { user } = useAuth();
  const [currentTz, setCurrentTz] = useState("");
  const [homeTz, setHomeTz] = useState("");
  const [saving, setSaving] = useState(false);

  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, `users/${user.uid}/settings/timezone`)).then((snap) => {
      const data = snap.data();
      setCurrentTz(data?.current_timezone ?? detectedTz);
      setHomeTz(data?.home_timezone ?? detectedTz);
    });
  }, [user, detectedTz]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, `users/${user.uid}/settings/timezone`), {
        current_timezone: detectedTz,
        home_timezone: homeTz,
        updated_at: new Date().toISOString(),
      }, { merge: true });
      setCurrentTz(detectedTz);
      toast.success("Timezone saved");
    } catch {
      toast.error("Failed to save timezone");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <RiGlobalLine className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-semibold text-text-primary">Timezone</h2>
      </div>

      <div className="space-y-3">
        <div>
          <p className="label">Current device timezone</p>
          <p className="text-sm text-text-secondary mt-1 font-mono">{currentTz || detectedTz}</p>
          <p className="text-xs text-text-muted mt-0.5">
            Auto-detected from this device on every visit. Updates automatically when you travel.
          </p>
        </div>

        <div>
          <label className="label">Home timezone</label>
          <p className="text-xs text-text-muted mb-1.5">
            Used instead of current device timezone when you want a fixed schedule regardless of travel.
          </p>
          <select
            className="input"
            value={homeTz || detectedTz}
            onChange={(e) => setHomeTz(e.target.value)}
          >
            {/* Show the current detected timezone even if not in the list */}
            {!COMMON_TIMEZONES.includes(detectedTz) && (
              <option value={detectedTz}>{tzLabel(detectedTz)}</option>
            )}
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tzLabel(tz)}</option>
            ))}
          </select>
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary text-sm w-full">
        {saving ? "Saving…" : "Save Timezone"}
      </button>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RiAddLine, RiDeleteBinLine, RiLeafLine } from "react-icons/ri";
import toast from "react-hot-toast";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface ProtectedWindow {
  label: string;
  days: number[];    // 0 = Sun … 6 = Sat
  allDay: boolean;
  startHour: number; // 0–23
  endHour: number;   // 1–24
}

export default function ProtectedTimeSettings() {
  const { user } = useAuth();
  const [windows, setWindows] = useState<ProtectedWindow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, `users/${user.uid}/settings/protected_time`), (snap) => {
      if (snap.exists()) setWindows((snap.data().windows as ProtectedWindow[]) ?? []);
      setLoaded(true);
    });
  }, [user]);

  const persist = async (next: ProtectedWindow[]) => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, `users/${user.uid}/settings/protected_time`), { windows: next });
      toast.success("Protected time saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addWindow = () => {
    const next: ProtectedWindow[] = [...windows, { label: "Family time", days: [6], allDay: false, startHour: 18, endHour: 22 }];
    setWindows(next);
    persist(next);
  };

  const removeWindow = (idx: number) => {
    const next = windows.filter((_, i) => i !== idx);
    setWindows(next);
    persist(next);
  };

  const patchWindow = (idx: number, patch: Partial<ProtectedWindow>, autoSave = false) => {
    const next = windows.map((w, i) => i === idx ? { ...w, ...patch } : w);
    setWindows(next);
    if (autoSave) persist(next);
  };

  const toggleDay = (idx: number, day: number) => {
    const w = windows[idx];
    const days = w.days.includes(day) ? w.days.filter((d) => d !== day) : [...w.days, day];
    patchWindow(idx, { days }, true);
  };

  if (!loaded) return null;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiLeafLine className="w-4 h-4 text-accent" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Protected Time</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Time blocks where the app stays completely silent — no notifications, no nudges.
            </p>
          </div>
        </div>
        <button
          onClick={addWindow}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-text-secondary hover:text-text-primary transition-colors"
        >
          <RiAddLine className="w-3.5 h-3.5" /> Add window
        </button>
      </div>

      {windows.length === 0 && (
        <p className="text-xs text-text-muted italic">
          No protected windows yet. Add one to designate time the app goes dark — Sabbath, family evenings, device-free mornings.
        </p>
      )}

      {windows.map((w, idx) => (
        <div
          key={idx}
          className="rounded-xl p-3 border border-white/10 space-y-3"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          {/* Label + delete */}
          <div className="flex items-center justify-between gap-2">
            <input
              value={w.label}
              onChange={(e) => patchWindow(idx, { label: e.target.value })}
              onBlur={() => persist(windows)}
              className="flex-1 bg-transparent text-sm font-medium text-text-primary border-b border-white/10 focus:border-accent/50 outline-none pb-0.5 transition-colors"
              placeholder="Label (e.g. Sabbath)"
            />
            <button onClick={() => removeWindow(idx)} className="text-text-muted hover:text-danger transition-colors shrink-0">
              <RiDeleteBinLine className="w-4 h-4" />
            </button>
          </div>

          {/* Day pills */}
          <div className="flex gap-1.5 flex-wrap">
            {DAY_NAMES.map((name, day) => (
              <button
                key={day}
                onClick={() => toggleDay(idx, day)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                  w.days.includes(day)
                    ? "bg-accent/20 text-accent border-accent/30"
                    : "bg-white/5 text-text-muted border-white/10 hover:text-text-primary"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          {/* All day toggle + hour range */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => patchWindow(idx, { allDay: !w.allDay }, true)}
              className="flex items-center gap-2"
            >
              <span className={`w-8 h-4 rounded-full transition-colors relative inline-block ${w.allDay ? "bg-accent" : "bg-white/20"}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${w.allDay ? "translate-x-4" : "translate-x-0.5"}`} />
              </span>
              <span className="text-xs text-text-secondary">All day</span>
            </button>

            {!w.allDay && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} max={23}
                  value={w.startHour}
                  onChange={(e) => patchWindow(idx, { startHour: Number(e.target.value) })}
                  onBlur={() => persist(windows)}
                  className="w-14 bg-white/10 border border-white/15 rounded-lg px-2 py-1 text-xs text-text-primary text-center outline-none focus:border-accent/50"
                />
                <span className="text-xs text-text-muted">to</span>
                <input
                  type="number" min={1} max={24}
                  value={w.endHour}
                  onChange={(e) => patchWindow(idx, { endHour: Number(e.target.value) })}
                  onBlur={() => persist(windows)}
                  className="w-14 bg-white/10 border border-white/15 rounded-lg px-2 py-1 text-xs text-text-primary text-center outline-none focus:border-accent/50"
                />
                <span className="text-xs text-text-muted">(24h)</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {windows.length > 0 && (
        <button
          onClick={() => persist(windows)}
          disabled={saving}
          className="w-full py-2 rounded-xl text-sm font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      )}
    </div>
  );
}

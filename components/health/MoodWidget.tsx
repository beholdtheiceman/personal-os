"use client";
import { useState } from "react";
import { RiEmotionLine, RiCheckLine } from "react-icons/ri";
import { useMood } from "@/hooks/useMood";

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function scoreColor(score: number) {
  if (score <= 3) return "text-danger bg-danger/10 border-danger/30";
  if (score <= 5) return "text-warning bg-warning/10 border-warning/30";
  if (score <= 7) return "text-accent bg-accent/10 border-accent/30";
  return "text-success bg-success/10 border-success/30";
}

function scoreLabel(score: number) {
  if (score <= 2) return "Rough";
  if (score <= 4) return "Low";
  if (score <= 6) return "Okay";
  if (score <= 8) return "Good";
  return "Great";
}

export default function MoodWidget() {
  const { today, history, loading, logMood } = useMood();
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNote, setShowNote] = useState(false);

  if (loading) return null;

  const handleLog = async (score: number) => {
    setSaving(true);
    await logMood(score, note || undefined);
    setSaving(false);
    setNote("");
    setShowNote(false);
    setSelected(null);
  };

  // 7-day history for sparkline
  const last7 = [...history].reverse().slice(-7);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiEmotionLine className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text-primary">Mood</h2>
        </div>
        {today && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${scoreColor(today.score)}`}>
            {today.score}/10 — {scoreLabel(today.score)}
          </span>
        )}
      </div>

      {today ? (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Logged today{today.note ? `: "${today.note}"` : ""}
          </p>
          {/* Re-log option */}
          <div className="flex flex-wrap gap-1.5">
            {SCORES.map((s) => (
              <button
                key={s}
                onClick={() => handleLog(s)}
                disabled={saving}
                className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                  today.score === s
                    ? scoreColor(today.score)
                    : "border-white/10 text-text-muted hover:border-accent/40 hover:text-text-primary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">How are you feeling today?</p>
          <div className="flex flex-wrap gap-1.5">
            {SCORES.map((s) => (
              <button
                key={s}
                onClick={() => setSelected(s)}
                className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                  selected === s
                    ? scoreColor(s)
                    : "border-white/10 text-text-muted hover:border-accent/40 hover:text-text-primary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {selected !== null && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${scoreColor(selected)}`}>
                  {selected}/10 — {scoreLabel(selected)}
                </span>
                <button
                  onClick={() => setShowNote((v) => !v)}
                  className="text-xs text-text-muted hover:text-text-secondary"
                >
                  {showNote ? "Hide note" : "+ Add note"}
                </button>
              </div>
              {showNote && (
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note..."
                  className="input-base text-sm"
                />
              )}
              <button
                onClick={() => handleLog(selected)}
                disabled={saving}
                className="btn-primary text-sm py-1.5 flex items-center gap-1.5"
              >
                <RiCheckLine className="w-4 h-4" />
                {saving ? "Logging..." : "Log Mood"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 7-day sparkline */}
      {last7.length > 1 && (
        <div className="pt-2 border-t border-bg-border">
          <p className="text-xs text-text-muted mb-2">Last {last7.length} days</p>
          <div className="flex items-end gap-1 h-8">
            {last7.map((entry, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className="w-full rounded-sm bg-accent/60"
                  style={{ height: `${(entry.score / 10) * 28}px` }}
                  title={`${entry.date}: ${entry.score}/10`}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

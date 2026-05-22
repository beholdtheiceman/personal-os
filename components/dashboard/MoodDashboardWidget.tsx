"use client";
import Link from "next/link";
import { RiEmotionLine } from "react-icons/ri";
import { useMood } from "@/hooks/useMood";

function scoreColor(score: number) {
  if (score <= 3) return "text-danger";
  if (score <= 5) return "text-warning";
  if (score <= 7) return "text-accent";
  return "text-success";
}

function scoreEmoji(score: number) {
  if (score <= 2) return "😞";
  if (score <= 4) return "😕";
  if (score <= 6) return "😐";
  if (score <= 8) return "🙂";
  return "😄";
}

export default function MoodDashboardWidget() {
  const { today, history, loading } = useMood();

  if (loading || (!today && history.length === 0)) return null;

  // Last 7 days for sparkline
  const last7 = [...history].reverse().slice(-7);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiEmotionLine className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text-primary">Mood</span>
        </div>
        <Link href="/health" className="text-xs text-text-muted hover:text-accent transition-colors">
          Log →
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {today ? (
          <>
            <span className="text-2xl">{scoreEmoji(today.score)}</span>
            <div>
              <p className={`text-lg font-bold ${scoreColor(today.score)}`}>
                {today.score}<span className="text-sm font-normal text-text-muted">/10</span>
              </p>
              {today.note && (
                <p className="text-xs text-text-muted truncate max-w-[140px]">{today.note}</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-text-muted">Not logged today</p>
        )}

        {/* Sparkline */}
        {last7.length > 1 && (
          <div className="flex items-end gap-0.5 h-8 ml-auto">
            {last7.map((entry, i) => (
              <div
                key={i}
                className={`w-2 rounded-sm ${today && entry.date === today.date ? "bg-accent" : "bg-accent/40"}`}
                style={{ height: `${(entry.score / 10) * 28}px` }}
                title={`${entry.date}: ${entry.score}/10`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

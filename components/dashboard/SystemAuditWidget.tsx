"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuth } from "firebase/auth";
import { RiRefreshLine, RiShieldCheckLine, RiCheckboxCircleLine, RiAlertLine, RiLightbulbLine } from "react-icons/ri";
import ReactMarkdown from "react-markdown";
import type { EngagementResult, SystemAuditDoc } from "@/lib/system-audit";

const STATUS_COLORS: Record<string, string> = {
  active:  "text-emerald-400",
  light:   "text-amber-400",
  dormant: "text-text-muted",
};

function EngagementBar({ items }: { items: EngagementResult[] }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 mt-3">
      {items.map((e) => (
        <div key={e.label} className="flex flex-col gap-0.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/[0.08]">
          <span className="text-[10px] text-text-muted leading-tight">{e.label}</span>
          <span className={`text-[11px] font-semibold ${STATUS_COLORS[e.status]}`}>
            {e.entries90d > 0 ? `${e.entries90d} entries` : "No activity"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SystemAuditWidget() {
  const { user } = useAuth();
  const [doc, setDoc] = useState<SystemAuditDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showEngagement, setShowEngagement] = useState(false);

  const fetchAudit = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch("/api/system-audit", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setDoc(data.doc ?? null);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const runAudit = async () => {
    if (!user || running) return;
    setRunning(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch("/api/system-audit", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.doc) setDoc(data.doc);
    } catch { /* silent */ }
    finally { setRunning(false); }
  };

  // Stale if older than 80 days
  const isStale = doc?.date
    ? doc.date < new Date(Date.now() - 80 * 86400000).toISOString().slice(0, 10)
    : false;

  return (
    <div
      className="rounded-2xl p-4 border border-white/10"
      style={{ background: "rgba(10, 4, 16, 0.82)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiShieldCheckLine className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">System Audit</span>
          {doc?.date && (
            <span className={`text-[10px] font-medium ${isStale ? "text-amber-400/70" : "text-text-muted"}`}>
              {isStale ? "overdue" : doc.date}
            </span>
          )}
        </div>
        <button
          onClick={runAudit}
          disabled={running}
          title="Run quarterly audit"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-white/10 transition-colors disabled:opacity-40"
        >
          <RiRefreshLine className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-1">
          <div className="w-3 h-3 rounded-full border-2 border-accent/40 border-t-accent animate-spin" />
          <span className="text-xs text-text-muted">Loading...</span>
        </div>
      ) : doc?.content ? (
        <>
          <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed
            [&_h2]:text-[11px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:text-text-secondary [&_h2]:mt-3 [&_h2]:mb-1.5
            [&_ul]:space-y-1 [&_li]:text-text-primary [&_li]:leading-snug [&_p]:text-text-primary">
            <ReactMarkdown>{doc.content}</ReactMarkdown>
          </div>
          <button
            onClick={() => setShowEngagement((v) => !v)}
            className="mt-3 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
          >
            {showEngagement ? "Hide tracker breakdown ▲" : "Show tracker breakdown ▼"}
          </button>
          {showEngagement && doc.engagement && <EngagementBar items={doc.engagement} />}
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-text-muted leading-relaxed">
            Run a quarterly audit to see which trackers are active, which have gone quiet, and get one honest recommendation.
          </p>
          <div className="flex gap-3 text-[11px] text-text-muted mt-2">
            <span className="flex items-center gap-1"><RiCheckboxCircleLine className="w-3 h-3 text-emerald-400" /> Active</span>
            <span className="flex items-center gap-1"><RiAlertLine className="w-3 h-3 text-amber-400" /> Light use</span>
            <span className="flex items-center gap-1"><RiLightbulbLine className="w-3 h-3 text-text-muted" /> Dormant</span>
          </div>
          <button
            onClick={runAudit}
            disabled={running}
            className="text-xs text-accent hover:text-accent/80 font-medium transition-colors disabled:opacity-40"
          >
            {running ? "Running audit…" : "Run audit now →"}
          </button>
        </div>
      )}
    </div>
  );
}

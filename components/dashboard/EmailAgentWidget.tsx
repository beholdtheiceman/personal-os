"use client";
import { useState } from "react";
import Link from "next/link";
import { getAuth } from "firebase/auth";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  RiMailSettingsLine, RiPlayLine, RiLoader4Line, RiAlertLine,
  RiExternalLinkLine, RiSearchLine, RiMailUnreadLine, RiCloseLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useEmailAgentStatus } from "@/hooks/useEmailAgentStatus";

interface UnsubscribeSuggestion {
  sender: string;
  email: string;
  reason: string;
}

interface AnalysisResult {
  summary: string;
  unsubscribe: UnsubscribeSuggestion[];
}

export default function EmailAgentWidget() {
  const { user } = useAuth();
  const { status, loading } = useEmailAgentStatus();
  const [running,   setRunning]   = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis,  setAnalysis]  = useState<AnalysisResult | null>(null);

  const runNow = async () => {
    if (!user || running) return;
    setRunning(true);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`/api/gmail/agent?uid=${user.uid}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const result = data.results?.[user.uid];
      if (result?.error) throw new Error(result.error);
      const total = (result?.subscriptions ?? 0) + (result?.transactions ?? 0);
      toast.success(total > 0 ? `Imported ${total} item${total !== 1 ? "s" : ""} from email` : "Inbox scanned — nothing new");
    } catch (err) {
      toast.error(`Agent failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const analyzeInbox = async () => {
    if (!user || analyzing) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch("/api/gmail/analyze", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data: AnalysisResult = await res.json();
      setAnalysis(data);
    } catch (err) {
      toast.error(`Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const lastRunLabel = status?.last_run_at
    ? formatDistanceToNow(parseISO(status.last_run_at), { addSuffix: true })
    : "Never";
  const weekCount = status?.stats?.last_week_count ?? 0;
  const hasError  = !!status?.last_error;

  return (
    <div className="card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiMailSettingsLine className="w-4 h-4 text-accent" />
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            Email Agent
          </h2>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
          auto
        </span>
      </div>

      {/* Error banner */}
      {hasError && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.20)" }}>
          <RiAlertLine className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
          <p className="text-xs text-danger line-clamp-2">{status?.last_error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Last run</p>
          <p className="text-sm font-medium text-text-primary">{lastRunLabel}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">This week</p>
          <p className="text-sm font-semibold text-accent">
            {weekCount} item{weekCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={runNow}
          disabled={running || analyzing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? <RiLoader4Line className="w-3.5 h-3.5 animate-spin" /> : <RiPlayLine className="w-3.5 h-3.5" />}
          {running ? "Scanning…" : "Run now"}
        </button>
        <button
          onClick={analyzeInbox}
          disabled={running || analyzing}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/[0.10] text-text-secondary hover:bg-white/[0.16] hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? <RiLoader4Line className="w-3.5 h-3.5 animate-spin" /> : <RiSearchLine className="w-3.5 h-3.5" />}
          {analyzing ? "Analyzing…" : "Analyze inbox"}
        </button>
        <Link
          href="/finance"
          className="ml-auto flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          View Finance <RiExternalLinkLine className="w-3 h-3" />
        </Link>
      </div>

      {/* Analysis results */}
      {analyzing && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <RiLoader4Line className="w-3.5 h-3.5 text-accent animate-spin" />
            <p className="text-xs text-text-secondary">Reading your inbox…</p>
          </div>
        </div>
      )}

      {analysis && !analyzing && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">Inbox summary</p>
              <button
                onClick={() => setAnalysis(null)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <RiCloseLine className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{analysis.summary}</p>
          </div>

          {/* Unsubscribe suggestions */}
          {analysis.unsubscribe.length > 0 && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2">
                <RiMailUnreadLine className="w-3.5 h-3.5 text-warning" />
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                  Consider unsubscribing ({analysis.unsubscribe.length})
                </p>
              </div>
              <div className="space-y-2">
                {analysis.unsubscribe.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5 border-t border-white/[0.06] first:border-0 first:pt-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{item.sender}</p>
                      <p className="text-xs text-text-muted truncate">{item.email}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-text-muted">
        Runs daily at 10 AM · Scans for receipts &amp; subscriptions
      </p>
    </div>
  );
}

"use client";
import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  RiMailForbidLine, RiScanLine, RiCheckboxLine, RiCheckboxBlankLine,
  RiCheckDoubleLine, RiCloseLine, RiLoader4Line,
} from "react-icons/ri";
import toast from "react-hot-toast";
import type { UnsubscribeCandidate } from "@/app/api/gmail/unsubscribe-scan/route";

type Status = "idle" | "scanning" | "ready" | "working";
type Result = "ok" | "error" | "pending";

export default function UnsubscribeWidget() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("idle");
  const [scanned, setScanned] = useState(0);
  const [candidates, setCandidates] = useState<UnsubscribeCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, Result>>({});
  const [open, setOpen] = useState(false);

  const scan = useCallback(async () => {
    if (!user) return;
    setStatus("scanning");
    setResults({});
    try {
      const res = await fetch(`/api/gmail/unsubscribe-scan?uid=${user.uid}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setCandidates(data.candidates ?? []);
      setScanned(data.scanned ?? 0);
      // Pre-select all by default
      setSelected(new Set((data.candidates ?? []).map((c: UnsubscribeCandidate) => c.emailId)));
      setStatus("ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
      setStatus("idle");
    }
  }, [user]);

  const toggle = (emailId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId);
      else next.add(emailId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.emailId)));
    }
  };

  const unsubscribeAll = async () => {
    if (!user || selected.size === 0) return;
    setStatus("working");

    // Init all selected as pending
    const init: Record<string, Result> = {};
    selected.forEach((id) => { init[id] = "pending"; });
    setResults(init);

    let successCount = 0;
    let failCount = 0;

    for (const emailId of selected) {
      try {
        const res = await fetch(`/api/gmail/unsubscribe?uid=${user.uid}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailId }),
        });
        const data = await res.json();
        const ok = res.ok && data.ok !== false;
        setResults((prev) => ({ ...prev, [emailId]: ok ? "ok" : "error" }));
        if (ok) successCount++; else failCount++;
      } catch {
        setResults((prev) => ({ ...prev, [emailId]: "error" }));
        failCount++;
      }
      // Small delay to avoid rate-limiting Gmail
      await new Promise((r) => setTimeout(r, 400));
    }

    setStatus("ready");
    if (successCount > 0) toast.success(`Unsubscribed from ${successCount} sender${successCount > 1 ? "s" : ""}`);
    if (failCount > 0) toast.error(`${failCount} failed — check results`);
  };

  const openModal = () => { setOpen(true); if (status === "idle") scan(); };
  const closeModal = () => { setOpen(false); if (status !== "working") setStatus("idle"); };

  const doneCount = Object.values(results).filter((r) => r === "ok").length;
  const allDone = status === "ready" && doneCount > 0 && doneCount === selected.size;

  return (
    <>
      {/* Dashboard card */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RiMailForbidLine className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold text-text-primary">Unsubscribe Manager</p>
          </div>
          <button
            onClick={openModal}
            className="btn-ghost text-xs flex items-center gap-1.5"
          >
            <RiScanLine className="w-3.5 h-3.5" /> Scan inbox
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Find and bulk-unsubscribe from newsletters and promotional emails in one click.
        </p>
      </div>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-bg-border overflow-hidden"
            style={{ background: "rgba(20, 8, 16, 0.98)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-bg-border shrink-0">
              <div>
                <p className="font-semibold text-text-primary flex items-center gap-2">
                  <RiMailForbidLine className="w-4 h-4 text-accent" /> Unsubscribe Manager
                </p>
                {status === "ready" && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {candidates.length} sender{candidates.length !== 1 ? "s" : ""} found · {scanned} emails scanned
                  </p>
                )}
              </div>
              <button
                onClick={closeModal}
                disabled={status === "working"}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-text-muted transition-colors disabled:opacity-40"
              >
                <RiCloseLine className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {status === "scanning" && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-text-muted">
                  <RiLoader4Line className="w-8 h-8 animate-spin text-accent" />
                  <p className="text-sm">Scanning inbox…</p>
                </div>
              )}

              {(status === "ready" || status === "working") && candidates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-text-muted">
                  <RiCheckDoubleLine className="w-8 h-8 text-success" />
                  <p className="text-sm">No promotional senders found</p>
                </div>
              )}

              {(status === "ready" || status === "working") && candidates.length > 0 && (
                <div className="divide-y divide-bg-border">
                  {/* Select all row */}
                  <button
                    onClick={toggleAll}
                    disabled={status === "working"}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left disabled:pointer-events-none"
                  >
                    {selected.size === candidates.length
                      ? <RiCheckboxLine className="w-4 h-4 text-accent shrink-0" />
                      : <RiCheckboxBlankLine className="w-4 h-4 text-text-muted shrink-0" />}
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                      {selected.size === candidates.length ? "Deselect all" : "Select all"}
                    </span>
                    <span className="ml-auto text-xs text-text-muted">{selected.size} selected</span>
                  </button>

                  {candidates.map((c) => {
                    const isSelected = selected.has(c.emailId);
                    const result = results[c.emailId];
                    return (
                      <button
                        key={c.emailId}
                        onClick={() => { if (status !== "working") toggle(c.emailId); }}
                        disabled={status === "working"}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/5 transition-colors text-left disabled:pointer-events-none"
                      >
                        {/* Checkbox / result indicator */}
                        <div className="shrink-0 w-4 h-4 flex items-center justify-center">
                          {result === "pending" && <RiLoader4Line className="w-4 h-4 text-accent animate-spin" />}
                          {result === "ok" && <span className="text-success text-base leading-none">✓</span>}
                          {result === "error" && <span className="text-danger text-base leading-none">✗</span>}
                          {!result && (isSelected
                            ? <RiCheckboxLine className="w-4 h-4 text-accent" />
                            : <RiCheckboxBlankLine className="w-4 h-4 text-text-muted" />)}
                        </div>

                        {/* Sender info */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${result === "ok" ? "text-text-muted line-through" : "text-text-primary"}`}>
                            {c.senderName}
                          </p>
                          <p className="text-xs text-text-muted truncate">{c.senderEmail}</p>
                        </div>

                        {/* Email count badge */}
                        <span className="text-xs text-text-muted shrink-0 bg-bg-tertiary px-1.5 py-0.5 rounded-full">
                          {c.count} email{c.count !== 1 ? "s" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {(status === "ready" || status === "working") && candidates.length > 0 && (
              <div className="px-5 py-4 border-t border-bg-border shrink-0 flex items-center gap-3">
                {allDone ? (
                  <p className="text-sm text-success flex items-center gap-1.5 flex-1">
                    <RiCheckDoubleLine className="w-4 h-4" /> All done!
                  </p>
                ) : (
                  <button
                    onClick={unsubscribeAll}
                    disabled={status === "working" || selected.size === 0}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {status === "working" ? (
                      <><RiLoader4Line className="w-4 h-4 animate-spin" /> Unsubscribing…</>
                    ) : (
                      <><RiMailForbidLine className="w-4 h-4" /> Unsubscribe from {selected.size} sender{selected.size !== 1 ? "s" : ""}</>
                    )}
                  </button>
                )}
                <button
                  onClick={() => { setStatus("idle"); scan(); }}
                  disabled={status === "working"}
                  className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-40"
                >
                  <RiScanLine className="w-3.5 h-3.5" /> Rescan
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

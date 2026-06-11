"use client";
import Link from "next/link";
import { RiLightbulbLine } from "react-icons/ri";
import { useIdeas } from "@/hooks/useIdeas";

export default function IdeasWidget() {
  const { raw, active, loading } = useIdeas();

  function handleTriage() {
    window.dispatchEvent(new CustomEvent("os:open-chat", {
      detail: { message: "Let's do a quick idea triage — show me my raw ideas and help me decide what to do with each one." },
    }));
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
          <RiLightbulbLine className="w-3.5 h-3.5 text-accent" /> Ideas Vault
        </h2>
        <Link href="/ideas" className="text-xs text-accent hover:text-accent-text">View all</Link>
      </div>
      {loading ? (
        <p className="text-xs text-text-muted py-2">Loading…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-2xl font-bold text-text-primary">{active.length}</p>
              <p className="text-xs text-text-muted">total ideas</p>
            </div>
            {raw.length > 0 && (
              <div>
                <p className="text-2xl font-bold text-accent">{raw.length}</p>
                <p className="text-xs text-text-muted">need triage</p>
              </div>
            )}
          </div>
          {raw.length > 0 ? (
            <button
              onClick={handleTriage}
              className="w-full text-xs py-2 px-3 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium"
            >
              Start triage with Claude →
            </button>
          ) : (
            <Link
              href="/ideas"
              className="block w-full text-xs py-2 px-3 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors text-center"
            >
              Capture a new idea →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

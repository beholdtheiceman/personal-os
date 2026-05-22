"use client";
import { useState } from "react";
import { useDecisions } from "@/hooks/useDecisions";
import DecisionCard from "@/components/decisions/DecisionCard";
import DecisionForm from "@/components/decisions/DecisionForm";
import { RiAddLine } from "react-icons/ri";
import type { Decision } from "@/types";

type Tab = "active" | "pending_review" | "all";

export default function DecisionsPage() {
  const { active, pendingReview, decisions, loading } = useDecisions();
  const [tab, setTab] = useState<Tab>("active");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Decision | null>(null);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "active", label: "Active", count: active.length },
    { key: "pending_review", label: "Pending Review", count: pendingReview.length },
    { key: "all", label: "All" },
  ];

  const listed =
    tab === "active" ? active :
    tab === "pending_review" ? pendingReview :
    decisions;

  const handleEdit = (d: Decision) => {
    setEditing(d);
    setShowForm(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Decision Journal</h1>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary flex items-center gap-1.5 text-sm"
        >
          <RiAddLine className="w-4 h-4" />
          Log Decision
        </button>
      </div>

      {(showForm) && (
        <div className="card">
          <h2 className="text-sm font-semibold text-text-primary mb-4">{editing ? "Edit Decision" : "New Decision"}</h2>
          <DecisionForm
            onClose={() => { setShowForm(false); setEditing(null); }}
            initial={editing ?? undefined}
          />
        </div>
      )}

      <div className="flex gap-1 border-b border-bg-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 text-xs bg-bg-tertiary rounded-full px-1.5 py-0.5">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? null : listed.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">
          {tab === "pending_review"
            ? "No decisions due for review."
            : tab === "active"
            ? "No active decisions. Log one to start tracking."
            : "No decisions logged yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {listed.map((d) => (
            <DecisionCard key={d.id} decision={d} onEdit={handleEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

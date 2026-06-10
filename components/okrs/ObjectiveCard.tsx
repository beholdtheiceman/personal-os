"use client";
import { useState } from "react";
import type { Objective, KeyResult } from "@/types";
import { RiCheckLine, RiEditLine, RiDeleteBinLine, RiArrowDownSLine, RiArrowUpSLine, RiAddLine } from "react-icons/ri";
import { format, parseISO } from "date-fns";

interface Props {
  objective: Objective;
  onUpdate: (id: string, updates: Partial<Objective>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function krProgress(kr: KeyResult) {
  if (kr.target === 0) return kr.completed ? 1 : 0;
  return Math.min(1, kr.current / kr.target);
}

function overallScore(objective: Objective): number {
  if (objective.review) return objective.review.score;
  const krs = objective.keyResults;
  if (krs.length === 0) return 0;
  return krs.reduce((s, kr) => s + krProgress(kr), 0) / krs.length;
}

function scoreColor(s: number) {
  if (s >= 0.7) return "text-success";
  if (s >= 0.4) return "text-amber-400";
  return "text-danger/80";
}

export default function ObjectiveCard({ objective, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [editingKR, setEditingKR] = useState<string | null>(null);
  const [krInput, setKRInput] = useState("");
  const [addingKR, setAddingKR] = useState(false);
  const [newKR, setNewKR] = useState({ title: "", target: "", unit: "" });

  const score = overallScore(objective);
  const pct = Math.round(score * 100);

  const updateKR = async (krId: string, current: number) => {
    const krs = objective.keyResults.map((kr) =>
      kr.id === krId ? { ...kr, current, completed: current >= kr.target } : kr
    );
    await onUpdate(objective.id, { keyResults: krs });
    setEditingKR(null);
  };

  const toggleKRComplete = async (krId: string) => {
    const krs = objective.keyResults.map((kr) =>
      kr.id === krId ? { ...kr, completed: !kr.completed } : kr
    );
    await onUpdate(objective.id, { keyResults: krs });
  };

  const addKR = async () => {
    const t = parseFloat(newKR.target);
    if (!newKR.title.trim() || isNaN(t)) return;
    const kr: KeyResult = {
      id: crypto.randomUUID(),
      title: newKR.title.trim(),
      target: t,
      current: 0,
      unit: newKR.unit.trim() || "units",
      completed: false,
    };
    await onUpdate(objective.id, { keyResults: [...objective.keyResults, kr] });
    setNewKR({ title: "", target: "", unit: "" });
    setAddingKR(false);
  };

  const removeKR = async (krId: string) => {
    await onUpdate(objective.id, { keyResults: objective.keyResults.filter((kr) => kr.id !== krId) });
  };

  return (
    <div className={`card border ${objective.status === "completed" ? "border-success/30 opacity-80" : "border-bg-border"}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-0.5 text-text-muted hover:text-text-primary transition-colors shrink-0"
        >
          {expanded ? <RiArrowUpSLine className="w-4 h-4" /> : <RiArrowDownSLine className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-full">{objective.quarter}</span>
            <span className={`text-xs font-semibold ${scoreColor(score)}`}>{pct}%</span>
            {objective.status === "completed" && (
              <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded-full">Completed</span>
            )}
          </div>
          <p className="text-sm font-semibold text-text-primary mt-1 leading-tight">{objective.title}</p>
          {objective.description && (
            <p className="text-xs text-text-muted mt-0.5">{objective.description}</p>
          )}
          <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all ${score >= 0.7 ? "bg-success" : score >= 0.4 ? "bg-amber-400" : "bg-accent"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {objective.status === "active" && (
            <button
              onClick={() => onUpdate(objective.id, { status: "completed" })}
              className="p-1 text-text-muted hover:text-success transition-colors"
              title="Mark completed"
            >
              <RiCheckLine className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(objective.id)}
            className="p-1 text-text-muted hover:text-danger transition-colors"
          >
            <RiDeleteBinLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pl-7 space-y-2">
          {objective.keyResults.length === 0 && !addingKR && (
            <p className="text-xs text-text-muted italic">No key results yet</p>
          )}
          {objective.keyResults.map((kr) => {
            const prog = krProgress(kr);
            return (
              <div key={kr.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleKRComplete(kr.id)}
                  className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${
                    kr.completed ? "bg-success border-success" : "border-bg-border hover:border-success/50"
                  }`}
                >
                  {kr.completed && <RiCheckLine className="w-2.5 h-2.5 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${kr.completed ? "line-through text-text-muted" : "text-text-primary"}`}>
                      {kr.title}
                    </span>
                    {editingKR === kr.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={krInput}
                          onChange={(e) => setKRInput(e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-xs rounded border border-accent bg-bg-secondary text-text-primary outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void updateKR(kr.id, parseFloat(krInput) || 0);
                            if (e.key === "Escape") setEditingKR(null);
                          }}
                        />
                        <button onClick={() => void updateKR(kr.id, parseFloat(krInput) || 0)} className="text-xs text-accent">✓</button>
                        <button onClick={() => setEditingKR(null)} className="text-xs text-text-muted">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingKR(kr.id); setKRInput(String(kr.current)); }}
                        className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <RiEditLine className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => removeKR(kr.id)}
                      className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-danger"
                    >
                      <RiDeleteBinLine className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-1 flex-1 rounded-full bg-bg-tertiary overflow-hidden">
                      <div
                        className={`h-full rounded-full ${prog >= 0.7 ? "bg-success" : prog >= 0.4 ? "bg-amber-400" : "bg-accent/60"}`}
                        style={{ width: `${Math.round(prog * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-muted shrink-0">
                      {kr.current}/{kr.target} {kr.unit}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {addingKR ? (
            <div className="space-y-1.5 pt-1">
              <input
                type="text"
                value={newKR.title}
                onChange={(e) => setNewKR({ ...newKR, title: e.target.value })}
                placeholder="Key result title"
                className="w-full px-2 py-1 text-xs rounded border border-bg-border bg-bg-secondary text-text-primary focus:border-accent outline-none"
                autoFocus
              />
              <div className="flex gap-1.5">
                <input
                  type="number"
                  value={newKR.target}
                  onChange={(e) => setNewKR({ ...newKR, target: e.target.value })}
                  placeholder="Target"
                  className="w-20 px-2 py-1 text-xs rounded border border-bg-border bg-bg-secondary text-text-primary focus:border-accent outline-none"
                />
                <input
                  type="text"
                  value={newKR.unit}
                  onChange={(e) => setNewKR({ ...newKR, unit: e.target.value })}
                  placeholder="Unit (e.g. workouts)"
                  className="flex-1 px-2 py-1 text-xs rounded border border-bg-border bg-bg-secondary text-text-primary focus:border-accent outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => void addKR()} className="text-xs text-accent hover:text-accent-text">Add</button>
                <button onClick={() => setAddingKR(false)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingKR(true)}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
            >
              <RiAddLine className="w-3 h-3" /> Add key result
            </button>
          )}

          {objective.review && (
            <div className="mt-3 p-2.5 rounded-lg bg-bg-tertiary border border-bg-border">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Q Review</span>
                <span className={`text-xs font-bold ${scoreColor(objective.review.score)}`}>
                  {objective.review.score.toFixed(1)}
                </span>
              </div>
              <p className="text-xs text-text-primary leading-relaxed">{objective.review.summary}</p>
              <p className="text-xs text-text-muted mt-1">
                {format(parseISO(objective.review.generated_at), "MMM d")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

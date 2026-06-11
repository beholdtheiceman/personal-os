"use client";
import { useState, useEffect, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSOP } from "@/contexts/SOPContext";
import { SOP_TEMPLATES } from "@/lib/sop-templates";
import { RiPlayLine, RiEditLine, RiDeleteBinLine, RiAddLine, RiArrowUpLine, RiArrowDownLine } from "react-icons/ri";
import type { SOP, SOPStep, SOPCategory } from "@/types";

const CATEGORY_LABELS: Record<SOPCategory, string> = {
  morning: "🌅 Morning", evening: "🌙 Evening", weekly: "📅 Weekly",
  monthly: "📆 Monthly", work: "💼 Work", custom: "⚙️ Custom",
};

type Tab = "mine" | "templates";

export default function SOPManager() {
  const { user } = useAuth();
  const { activateSOP } = useSOP();
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [tab, setTab] = useState<Tab>("mine");
  const [editing, setEditing] = useState<Partial<SOP> | null>(null);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, `users/${user.uid}/sops`), (snap) => {
      setSOPs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SOP))
        .sort((a, b) => a.title.localeCompare(b.title)));
    });
  }, [user]);

  const handleRun = useCallback((sop: SOP) => {
    activateSOP(sop.id, sop.title, sop.steps.length);
    window.dispatchEvent(new CustomEvent("os:open-chat"));
  }, [activateSOP]);

  async function saveSOP() {
    if (!user || !editing?.title?.trim()) return;
    const data = {
      title: editing.title.trim(),
      description: editing.description ?? "",
      category: editing.category ?? "custom",
      triggerPhrases: editing.triggerPhrases ?? [],
      steps: (editing.steps ?? []).filter((s) => s.title.trim()),
      updated_at: new Date().toISOString(),
    };
    if (isNew) {
      await addDoc(collection(db, `users/${user.uid}/sops`), { ...data, created_at: new Date().toISOString() });
    } else if (editing.id) {
      await updateDoc(doc(db, `users/${user.uid}/sops/${editing.id}`), data);
    }
    setEditing(null);
    setIsNew(false);
  }

  async function deleteSOP(id: string) {
    if (!user || !confirm("Delete this SOP?")) return;
    await deleteDoc(doc(db, `users/${user.uid}/sops/${id}`));
  }

  async function copyTemplate(tpl: Omit<SOP, "created_at" | "updated_at">) {
    if (!user) return;
    const now = new Date().toISOString();
    const { id: _id, ...rest } = tpl;
    await addDoc(collection(db, `users/${user.uid}/sops`), { ...rest, created_at: now, updated_at: now });
    setTab("mine");
  }

  function startNew() {
    setEditing({ title: "", category: "custom", description: "", triggerPhrases: [], steps: [] });
    setIsNew(true);
  }

  function startEdit(sop: SOP) {
    setEditing({ ...sop, steps: sop.steps.map((s) => ({ ...s })) });
    setIsNew(false);
  }

  function addStep() {
    setEditing((e) => e ? { ...e, steps: [...(e.steps ?? []), { id: crypto.randomUUID(), title: "", type: "action" as const }] } : e);
  }

  function updateStep(i: number, field: keyof SOPStep, val: string) {
    setEditing((e) => {
      if (!e) return e;
      const steps = [...(e.steps ?? [])];
      steps[i] = { ...steps[i], [field]: val };
      return { ...e, steps };
    });
  }

  function removeStep(i: number) {
    setEditing((e) => e ? { ...e, steps: (e.steps ?? []).filter((_, j) => j !== i) } : e);
  }

  function moveStep(i: number, dir: -1 | 1) {
    setEditing((e) => {
      if (!e) return e;
      const steps = [...(e.steps ?? [])];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return e;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...e, steps };
    });
  }

  function updatePhrases(val: string) {
    setEditing((e) => e ? { ...e, triggerPhrases: val.split(",").map((s) => s.trim()).filter(Boolean) } : e);
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(["mine", "templates"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-accent text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"}`}>
            {t === "mine" ? "My SOPs" : "Starter Templates"}
          </button>
        ))}
        {tab === "mine" && (
          <button onClick={startNew} className="ml-auto mb-2 btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <RiAddLine className="w-3.5 h-3.5" /> New SOP
          </button>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">{isNew ? "New SOP" : "Edit SOP"}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Title *</label>
              <input value={editing.title ?? ""} onChange={(e) => setEditing((x) => ({ ...x, title: e.target.value }))}
                className="input-base w-full" placeholder="Morning Startup" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Category</label>
              <select value={editing.category ?? "custom"} onChange={(e) => setEditing((x) => ({ ...x, category: e.target.value as SOPCategory }))}
                className="input-base w-full">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Description</label>
            <textarea value={editing.description ?? ""} onChange={(e) => setEditing((x) => ({ ...x, description: e.target.value }))}
              className="input-base w-full" rows={2} placeholder="What does this SOP accomplish?" />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Trigger phrases (comma-separated)</label>
            <input value={(editing.triggerPhrases ?? []).join(", ")} onChange={(e) => updatePhrases(e.target.value)}
              className="input-base w-full" placeholder="run my morning routine, start my day" />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-text-muted">Steps</label>
              <button onClick={addStep} className="text-xs text-accent hover:underline flex items-center gap-1">
                <RiAddLine className="w-3 h-3" /> Add step
              </button>
            </div>
            <div className="space-y-2">
              {(editing.steps ?? []).map((step, i) => (
                <div key={step.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-white/5">
                  <span className="text-xs text-text-muted mt-2 w-5 shrink-0 text-center">{i + 1}</span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                    <input value={step.title} onChange={(e) => updateStep(i, "title", e.target.value)}
                      className="input-base text-sm" placeholder="Step description" />
                    <select value={step.type} onChange={(e) => updateStep(i, "type", e.target.value)}
                      className="input-base text-xs w-full sm:w-28">
                      <option value="action">⚡ Action</option>
                      <option value="question">❓ Question</option>
                      <option value="navigate">🧭 Navigate</option>
                      <option value="reminder">🔔 Reminder</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveStep(i, -1)} disabled={i === 0}
                      className="p-0.5 text-text-muted hover:text-text-primary disabled:opacity-30">
                      <RiArrowUpLine className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveStep(i, 1)} disabled={i === (editing.steps?.length ?? 0) - 1}
                      className="p-0.5 text-text-muted hover:text-text-primary disabled:opacity-30">
                      <RiArrowDownLine className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button onClick={() => removeStep(i)} className="p-1 text-text-muted hover:text-danger shrink-0 mt-0.5">
                    <RiDeleteBinLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {(editing.steps ?? []).length === 0 && (
                <p className="text-xs text-text-muted text-center py-3">No steps yet — add the first one above.</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={saveSOP} disabled={!editing.title?.trim()} className="btn-primary text-sm px-4">Save</button>
            <button onClick={() => { setEditing(null); setIsNew(false); }} className="btn-secondary text-sm px-4">Cancel</button>
          </div>
        </div>
      )}

      {/* My SOPs list */}
      {tab === "mine" && !editing && (
        <div className="space-y-3">
          {sops.length === 0 && (
            <div className="text-center py-10 text-text-muted">
              <p className="text-sm mb-3">No SOPs yet. Create one or copy a starter template.</p>
              <button onClick={() => setTab("templates")} className="text-accent text-sm hover:underline">
                Browse templates →
              </button>
            </div>
          )}
          {sops.map((sop) => (
            <div key={sop.id} className="glass-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-semibold text-text-primary">{sop.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-text-muted">
                      {CATEGORY_LABELS[sop.category] ?? sop.category}
                    </span>
                    <span className="text-[10px] text-text-muted">{sop.steps.length} steps</span>
                  </div>
                  {sop.description && (
                    <p className="text-xs text-text-secondary mb-2 line-clamp-1">{sop.description}</p>
                  )}
                  {sop.triggerPhrases.length > 0 && (
                    <p className="text-[10px] text-text-muted">
                      Say: &ldquo;{sop.triggerPhrases[0]}&rdquo;
                      {sop.triggerPhrases.length > 1 && ` +${sop.triggerPhrases.length - 1} more`}
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => handleRun(sop)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-xs font-medium transition-colors">
                    <RiPlayLine className="w-3.5 h-3.5" /> Run
                  </button>
                  <button onClick={() => startEdit(sop)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-text-secondary transition-colors">
                    <RiEditLine className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteSOP(sop.id)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-danger/20 text-text-secondary hover:text-danger transition-colors">
                    <RiDeleteBinLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Templates list */}
      {tab === "templates" && (
        <div className="space-y-3">
          {SOP_TEMPLATES.map((tpl) => (
            <div key={tpl.id} className="glass-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-semibold text-text-primary">{tpl.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-text-muted">
                      {CATEGORY_LABELS[tpl.category]}
                    </span>
                    <span className="text-[10px] text-text-muted">{tpl.steps.length} steps</span>
                  </div>
                  {tpl.description && <p className="text-xs text-text-secondary mb-2">{tpl.description}</p>}
                  <div className="flex flex-col gap-1 mt-2">
                    {tpl.steps.slice(0, 3).map((s, i) => (
                      <p key={i} className="text-[11px] text-text-muted">{i + 1}. {s.title}</p>
                    ))}
                    {tpl.steps.length > 3 && (
                      <p className="text-[11px] text-text-muted">+{tpl.steps.length - 3} more steps</p>
                    )}
                  </div>
                </div>
                <button onClick={() => copyTemplate(tpl)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-text-secondary transition-colors">
                  <RiAddLine className="w-3.5 h-3.5" /> Add to mine
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

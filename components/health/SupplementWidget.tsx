"use client";
import { useState } from "react";
import {
  RiAddLine, RiCheckboxCircleLine, RiCheckboxBlankCircleLine,
  RiDeleteBinLine, RiEditLine, RiCloseLine, RiCheckLine,
  RiCapsuleLine,
} from "react-icons/ri";
import { useSupplements } from "@/hooks/useSupplements";
import type { Supplement, SupplementTiming } from "@/types";
import toast from "react-hot-toast";

const TIMING_LABELS: Record<SupplementTiming, string> = {
  morning:     "Morning",
  afternoon:   "Afternoon",
  evening:     "Evening",
  with_meals:  "With Meals",
  before_bed:  "Before Bed",
};

const TIMING_OPTIONS: SupplementTiming[] = ["morning", "afternoon", "evening", "with_meals", "before_bed"];

interface FormState {
  name: string;
  dosage: string;
  timing: SupplementTiming;
  notes: string;
  active: boolean;
}

const DEFAULT_FORM: FormState = { name: "", dosage: "", timing: "morning", notes: "", active: true };

export default function SupplementWidget() {
  const {
    supplements, active, takenIds, takenCount, totalActive, allTaken,
    addSupplement, updateSupplement, deleteSupplement, toggleTaken,
  } = useSupplements();

  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Supplement | null>(null);
  const [form,      setForm]      = useState<FormState>(DEFAULT_FORM);
  const [showAll,   setShowAll]   = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  };

  const openEdit = (s: Supplement) => {
    setEditing(s);
    setForm({ name: s.name, dosage: s.dosage, timing: s.timing, notes: s.notes ?? "", active: s.active });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.dosage.trim()) return toast.error("Dosage is required");
    if (editing) {
      await updateSupplement(editing.id, form);
    } else {
      await addSupplement(form);
    }
    setShowForm(false);
    setEditing(null);
  };

  const displayList = showAll ? supplements : active;

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiCapsuleLine className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-text-primary">Supplements</span>
        </div>
        <div className="flex items-center gap-2">
          {totalActive > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              allTaken ? "bg-success/15 text-success" : "bg-bg-tertiary text-text-muted"
            }`}>
              {takenCount}/{totalActive}
            </span>
          )}
          <button onClick={openAdd} className="btn-ghost p-1.5">
            <RiAddLine className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* All-taken banner */}
      {allTaken && totalActive > 0 && (
        <div className="flex items-center gap-2 bg-success/10 text-success text-xs px-3 py-2 rounded-xl">
          <RiCheckboxCircleLine className="w-4 h-4" />
          All supplements taken today!
        </div>
      )}

      {/* Supplement list */}
      {displayList.length === 0 && !showAll ? (
        <p className="text-xs text-text-muted text-center py-4">
          No active supplements. <button onClick={openAdd} className="text-accent hover:underline">Add one</button>
        </p>
      ) : (
        <div className="space-y-1.5">
          {displayList.map((s) => {
            const taken = takenIds.has(s.id);
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                  taken ? "bg-success/8" : "bg-bg-secondary"
                } ${!s.active ? "opacity-50" : ""}`}
              >
                <button onClick={() => s.active && toggleTaken(s.id)} disabled={!s.active} className="shrink-0">
                  {taken
                    ? <RiCheckboxCircleLine className="w-5 h-5 text-success" />
                    : <RiCheckboxBlankCircleLine className="w-5 h-5 text-text-muted" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${taken ? "line-through text-text-muted" : "text-text-primary"}`}>
                    {s.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {s.dosage} · {TIMING_LABELS[s.timing]}
                    {!s.active && " · Inactive"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(s)} className="btn-ghost p-1"><RiEditLine className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteSupplement(s.id)} className="btn-ghost p-1 text-danger hover:text-danger/80">
                    <RiDeleteBinLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show all / active toggle */}
      {supplements.length > active.length && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-text-muted hover:text-text-secondary w-full text-center"
        >
          {showAll ? "Show active only" : `Show all (${supplements.length - active.length} inactive)`}
        </button>
      )}

      {/* Add / Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">
                {editing ? "Edit Supplement" : "Add Supplement"}
              </h3>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1"><RiCloseLine className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Vitamin D3" className="input-base text-sm" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Dosage *</label>
                  <input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="2000 IU" className="input-base text-sm" />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Timing</label>
                  <select value={form.timing} onChange={(e) => setForm({ ...form, timing: e.target.value as SupplementTiming })} className="input text-sm">
                    {TIMING_OPTIONS.map((t) => <option key={t} value={t}>{TIMING_LABELS[t]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Notes (optional)</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Take with food" className="input-base text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active-toggle" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 rounded" />
                <label htmlFor="active-toggle" className="text-sm text-text-secondary">Active (included in daily checklist)</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn-primary text-sm py-1.5 flex items-center gap-1.5">
                <RiCheckLine className="w-4 h-4" />
                {editing ? "Update" : "Add"}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost text-sm py-1.5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

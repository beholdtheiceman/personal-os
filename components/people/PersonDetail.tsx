"use client";
import { useState } from "react";
import { doc, deleteDoc, addDoc, collection, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useInteractions, daysSince } from "@/hooks/usePeople";
import {
  RiCloseLine, RiPencilLine, RiDeleteBinLine, RiAddLine,
  RiPhoneLine, RiMailLine, RiMapPinLine, RiBuildingLine,
  RiCakeLine, RiGiftLine, RiCheckLine, RiTimeLine,
} from "react-icons/ri";
import type { Person, InteractionType } from "@/types";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";

const INTERACTION_TYPES: InteractionType[] = ["call", "text", "email", "in-person", "social", "other"];

const REL_COLORS: Record<string, string> = {
  friend:      "bg-blue-500/20 text-blue-300",
  family:      "bg-rose-500/20 text-rose-300",
  colleague:   "bg-amber-500/20 text-amber-300",
  acquaintance:"bg-purple-500/20 text-purple-300",
  other:       "bg-white/10 text-text-secondary",
};

interface Props {
  person: Person;
  onEdit: () => void;
  onClose: () => void;
  onDeleted: () => void;
}

export default function PersonDetail({ person, onEdit, onClose, onDeleted }: Props) {
  const { user } = useAuth();
  const { interactions } = useInteractions(person.id);
  const [logType, setLogType] = useState<InteractionType>("call");
  const [logDate, setLogDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [logNotes, setLogNotes] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const days = daysSince(person.last_contacted);

  const logInteraction = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, "users", user.uid, "people", person.id, "interactions"), {
        person_id: person.id,
        date: logDate,
        type: logType,
        notes: logNotes.trim() || undefined,
        created_at: now,
      });
      // Update last_contacted on person
      await updateDoc(doc(db, "users", user.uid, "people", person.id), {
        last_contacted: logDate,
        updated_at: now,
      });
      toast.success("Interaction logged");
      setShowLog(false);
      setLogNotes("");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "people", person.id));
    toast.success(`${person.name} removed`);
    onDeleted();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: "rgba(20, 8, 18, 0.97)", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent text-lg font-semibold shrink-0">
              {person.name[0].toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">{person.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${REL_COLORS[person.relationship]}`}>
                  {person.relationship}
                </span>
                {days !== null && (
                  <span className={`text-[10px] ${days > 60 ? "text-danger" : days > 30 ? "text-amber-400" : "text-text-muted"}`}>
                    Last contact: {days === 0 ? "today" : `${days}d ago`}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted transition-colors">
              <RiPencilLine className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted transition-colors">
              <RiCloseLine className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          {/* Contact info */}
          <div className="grid grid-cols-2 gap-2">
            {person.email && (
              <a href={`mailto:${person.email}`} className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors">
                <RiMailLine className="w-3.5 h-3.5 text-text-muted shrink-0" /> {person.email}
              </a>
            )}
            {person.phone && (
              <a href={`tel:${person.phone}`} className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors">
                <RiPhoneLine className="w-3.5 h-3.5 text-text-muted shrink-0" /> {person.phone}
              </a>
            )}
            {person.location && (
              <span className="flex items-center gap-2 text-xs text-text-secondary">
                <RiMapPinLine className="w-3.5 h-3.5 text-text-muted shrink-0" /> {person.location}
              </span>
            )}
            {person.company && (
              <span className="flex items-center gap-2 text-xs text-text-secondary">
                <RiBuildingLine className="w-3.5 h-3.5 text-text-muted shrink-0" /> {person.company}
              </span>
            )}
            {person.birthday && (
              <span className="flex items-center gap-2 text-xs text-text-secondary">
                <RiCakeLine className="w-3.5 h-3.5 text-text-muted shrink-0" />
                {format(parseISO(person.birthday), "MMMM d")}
              </span>
            )}
          </div>

          {/* Follow-up */}
          {person.follow_up_date && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-accent/10 border border-accent/20">
              <RiTimeLine className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-accent">Follow up {format(parseISO(person.follow_up_date), "MMM d")}</p>
                {person.follow_up_note && <p className="text-xs text-text-secondary mt-0.5">{person.follow_up_note}</p>}
              </div>
            </div>
          )}

          {/* Notes */}
          {person.notes && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Notes</p>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{person.notes}</p>
            </div>
          )}

          {/* Gift ideas */}
          {person.gift_ideas && person.gift_ideas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-1.5">
                <RiGiftLine className="w-3.5 h-3.5" /> Gift Ideas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {person.gift_ideas.map((g, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-white/10 text-text-secondary">{g}</span>
                ))}
              </div>
            </div>
          )}

          {/* Log interaction */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Interactions</p>
              <button
                onClick={() => setShowLog((s) => !s)}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                <RiAddLine className="w-3.5 h-3.5" /> Log
              </button>
            </div>

            {showLog && (
              <div className="p-3 rounded-xl space-y-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
                <div className="grid grid-cols-2 gap-2">
                  <select className="input-base text-sm" value={logType} onChange={(e) => setLogType(e.target.value as InteractionType)}>
                    {INTERACTION_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                  <input type="date" className="input-base text-sm" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
                </div>
                <input className="input-base w-full text-sm" placeholder="Notes (optional)" value={logNotes} onChange={(e) => setLogNotes(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={logInteraction} disabled={saving} className="btn-primary text-xs flex-1 disabled:opacity-50">
                    {saving ? "Saving…" : "Log interaction"}
                  </button>
                  <button onClick={() => setShowLog(false)} className="btn-ghost text-xs px-3">Cancel</button>
                </div>
              </div>
            )}

            {interactions.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-3">No interactions logged yet.</p>
            ) : (
              <div className="space-y-1">
                {interactions.map((i) => (
                  <div key={i.id} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-text-primary capitalize">{i.type}</span>
                        <span className="text-xs text-text-muted">{format(parseISO(i.date), "MMM d, yyyy")}</span>
                      </div>
                      {i.notes && <p className="text-xs text-text-secondary mt-0.5">{i.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-white/[0.08]">
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-xs text-text-muted hover:text-danger transition-colors">
                <RiDeleteBinLine className="w-3.5 h-3.5" /> Remove contact
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-danger">Remove {person.name}?</span>
                <button onClick={handleDelete} className="text-xs text-danger font-medium hover:text-danger/80">Yes, remove</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

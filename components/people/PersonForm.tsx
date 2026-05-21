"use client";
import { useState, useEffect } from "react";
import { doc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RiCloseLine, RiAddLine, RiDeleteBinLine } from "react-icons/ri";
import type { Person, RelationshipType, ContactFrequency } from "@/types";

const RELATIONSHIPS: RelationshipType[] = ["friend", "family", "colleague", "acquaintance", "other"];
const FREQUENCIES: { value: ContactFrequency; label: string }[] = [
  { value: "weekly",    label: "Weekly"    },
  { value: "monthly",   label: "Monthly"   },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly",    label: "Yearly"    },
];

interface Props {
  person?: Person | null;
  onClose: () => void;
}

export default function PersonForm({ person, onClose }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState(person?.name ?? "");
  const [relationship, setRelationship] = useState<RelationshipType>(person?.relationship ?? "friend");
  const [email, setEmail] = useState(person?.email ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [birthday, setBirthday] = useState(person?.birthday ?? "");
  const [location, setLocation] = useState(person?.location ?? "");
  const [company, setCompany] = useState(person?.company ?? "");
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [contactFrequency, setContactFrequency] = useState<ContactFrequency | "">(person?.contact_frequency ?? "");
  const [followUpDate, setFollowUpDate] = useState(person?.follow_up_date ?? "");
  const [followUpNote, setFollowUpNote] = useState(person?.follow_up_note ?? "");
  const [giftIdeas, setGiftIdeas] = useState<string[]>(person?.gift_ideas ?? []);
  const [giftInput, setGiftInput] = useState("");
  const [tags, setTags] = useState<string[]>(person?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addGift = () => {
    if (giftInput.trim()) { setGiftIdeas((g) => [...g, giftInput.trim()]); setGiftInput(""); }
  };
  const addTag = () => {
    if (tagInput.trim()) { setTags((t) => [...t, tagInput.trim().toLowerCase()]); setTagInput(""); }
  };

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const data: Omit<Person, "id"> = {
      name: name.trim(),
      relationship,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      birthday: birthday || undefined,
      location: location.trim() || undefined,
      company: company.trim() || undefined,
      notes: notes.trim() || undefined,
      contact_frequency: contactFrequency || undefined,
      follow_up_date: followUpDate || undefined,
      follow_up_note: followUpNote.trim() || undefined,
      gift_ideas: giftIdeas.length ? giftIdeas : undefined,
      tags: tags.length ? tags : undefined,
      last_contacted: person?.last_contacted,
      created_at: person?.created_at ?? now,
      updated_at: now,
    };
    // Strip undefined keys (Firestore rejects them)
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

    try {
      if (person) {
        await updateDoc(doc(db, "users", user.uid, "people", person.id), clean);
      } else {
        await addDoc(collection(db, "users", user.uid, "people"), clean);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh]"
        style={{ background: "rgba(20, 8, 18, 0.97)", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">{person ? "Edit contact" : "Add contact"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted transition-colors">
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>

        {/* Name + Relationship */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="text-xs text-text-muted">Name *</label>
            <input autoFocus className="input-base w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Relationship</label>
            <select className="input-base w-full capitalize" value={relationship} onChange={(e) => setRelationship(e.target.value as RelationshipType)}>
              {RELATIONSHIPS.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
        </div>

        {/* Contact info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Email</label>
            <input className="input-base w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Phone</label>
            <input className="input-base w-full" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Birthday</label>
            <input className="input-base w-full" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Location</label>
            <input className="input-base w-full" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-xs text-text-muted">Company / Role</label>
            <input className="input-base w-full" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company or role" />
          </div>
        </div>

        {/* Contact frequency + follow-up */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Keep in touch</label>
            <select className="input-base w-full" value={contactFrequency} onChange={(e) => setContactFrequency(e.target.value as ContactFrequency | "")}>
              <option value="">No target</option>
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Follow-up date</label>
            <input className="input-base w-full" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </div>
          {followUpDate && (
            <div className="space-y-1 col-span-2">
              <label className="text-xs text-text-muted">Follow-up note</label>
              <input className="input-base w-full" value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} placeholder="What to follow up on…" />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-xs text-text-muted">Notes</label>
          <textarea className="input-base w-full resize-none" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about this person…" />
        </div>

        {/* Gift ideas */}
        <div className="space-y-2">
          <label className="text-xs text-text-muted">Gift ideas</label>
          <div className="flex gap-2">
            <input className="input-base flex-1 text-sm" value={giftInput} onChange={(e) => setGiftInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGift()} placeholder="Add gift idea…" />
            <button onClick={addGift} className="btn-ghost px-3"><RiAddLine className="w-4 h-4" /></button>
          </div>
          {giftIdeas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {giftIdeas.map((g, i) => (
                <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-white/10 text-text-secondary">
                  {g}
                  <button onClick={() => setGiftIdeas((prev) => prev.filter((_, j) => j !== i))}><RiCloseLine className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label className="text-xs text-text-muted">Tags</label>
          <div className="flex gap-2">
            <input className="input-base flex-1 text-sm" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="Add tag…" />
            <button onClick={addTag} className="btn-ghost px-3"><RiAddLine className="w-4 h-4" /></button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t, i) => (
                <span key={i} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-accent/15 text-accent">
                  {t}
                  <button onClick={() => setTags((prev) => prev.filter((_, j) => j !== i))}><RiCloseLine className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={handleSave} disabled={saving || !name.trim()} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? "Saving…" : person ? "Save changes" : "Add contact"}
          </button>
          <button onClick={onClose} className="btn-ghost px-4">Cancel</button>
        </div>
      </div>
    </div>
  );
}

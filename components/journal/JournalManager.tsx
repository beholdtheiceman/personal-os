"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import JournalForm from "./JournalForm";
import JournalEntryCard from "./JournalEntryCard";
import { RiAddLine, RiBookLine } from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import toast from "react-hot-toast";
import type { JournalEntry } from "@/types";

export default function JournalManager() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "journal"),
      orderBy("created_at", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as JournalEntry)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const handleSave = async (text: string) => {
    if (!user) return;
    setAnalyzing(true);
    setShowForm(false);
    try {
      const res = await fetch("/api/journal/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const analysis = await res.json();
      if (analysis.error) throw new Error(analysis.error);

      await addDoc(collection(db, "users", user.uid, "journal"), {
        date: new Date().toISOString().split("T")[0],
        raw_transcript: text,
        ai_summary: analysis.summary ?? "",
        mood_score: analysis.mood_score ?? 5,
        tags: analysis.tags ?? [],
        created_at: new Date().toISOString(),
      });
      toast.success("Entry saved");
    } catch {
      toast.error("Failed to save entry");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "journal", id));
    toast.success("Entry deleted");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <RiAddLine className="w-4 h-4" /> New Entry
        </button>
      </div>

      {analyzing && (
        <div className="card flex items-center gap-3 text-sm text-text-secondary">
          <LoadingDots /> Analyzing your entry with AI…
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><LoadingDots /></div>
      ) : entries.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <RiBookLine className="w-12 h-12 text-text-muted mb-4" />
          <p className="text-text-secondary text-sm mb-4">No journal entries yet.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
            Write your first entry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <JournalEntryCard key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showForm && (
        <JournalForm onSave={handleSave} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

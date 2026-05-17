"use client";
// The full memory management UI — grouped by category, add/edit/delete entries
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_MEMORY_ENTRIES, buildMemoryContext } from "@/lib/memory";
import { RiAddLine, RiDeleteBinLine, RiEditLine, RiRefreshLine, RiCheckLine, RiCloseLine } from "react-icons/ri";
import toast from "react-hot-toast";
import type { MemoryEntry, MemoryCategory } from "@/types";
import LoadingDots from "@/components/ui/LoadingDots";

const CATEGORIES: MemoryCategory[] = [
  "Identity",
  "AI Interaction Style",
  "Personal Preferences",
  "Business & Work",
  "Health Baselines",
  "Financial Snapshot",
  "Current Priorities",
];

export default function MemoryManager() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ key: "", value: "" });
  const [addingCategory, setAddingCategory] = useState<MemoryCategory | null>(null);
  const [newEntry, setNewEntry] = useState({ key: "", value: "" });
  const [suggesting, setSuggesting] = useState(false);

  const memoryCol = () =>
    collection(db, "users", user!.uid, "memory");

  // Load all memory entries from Firestore
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const q = query(memoryCol(), orderBy("category"));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MemoryEntry));

        // If no entries exist yet, seed with defaults
        if (data.length === 0) {
          const now = new Date().toISOString();
          const seeded = await Promise.all(
            DEFAULT_MEMORY_ENTRIES.map((e) =>
              addDoc(memoryCol(), { ...e, lastUpdated: now })
            )
          );
          const newDocs = DEFAULT_MEMORY_ENTRIES.map((e, i) => ({
            id: seeded[i].id,
            ...e,
            lastUpdated: now,
          }));
          setEntries(newDocs);
        } else {
          setEntries(data);
        }
      } catch {
        toast.error("Failed to load memory");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const startEdit = (entry: MemoryEntry) => {
    setEditingId(entry.id);
    setEditValues({ key: entry.key, value: entry.value });
  };

  const saveEdit = async (id: string) => {
    try {
      const ref = doc(db, "users", user!.uid, "memory", id);
      await updateDoc(ref, {
        key: editValues.key,
        value: editValues.value,
        lastUpdated: new Date().toISOString(),
      });
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, ...editValues, lastUpdated: new Date().toISOString() } : e
        )
      );
      setEditingId(null);
      toast.success("Memory updated");
    } catch {
      toast.error("Failed to update");
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, "users", user!.uid, "memory", id));
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Entry deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const addEntry = async (category: MemoryCategory) => {
    if (!newEntry.key.trim()) return;
    try {
      const data = {
        category,
        key: newEntry.key.trim(),
        value: newEntry.value.trim(),
        lastUpdated: new Date().toISOString(),
      };
      const ref = await addDoc(memoryCol(), data);
      setEntries((prev) => [...prev, { id: ref.id, ...data }]);
      setNewEntry({ key: "", value: "" });
      setAddingCategory(null);
      toast.success("Memory entry added");
    } catch {
      toast.error("Failed to add entry");
    }
  };

  // Ask Claude to suggest new memory items based on recent activity
  const refreshMemory = async () => {
    setSuggesting(true);
    try {
      const res = await fetch("/api/memory/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingMemory: buildMemoryContext(entries),
          recentContent: "No recent journal or chat history available yet.",
        }),
      });
      const { suggestions } = await res.json();
      if (suggestions?.length) {
        toast.success(`${suggestions.length} suggestions ready — review and add them manually.`);
        console.log("Memory suggestions:", suggestions);
      } else {
        toast("No new suggestions from Claude", { icon: "🤔" });
      }
    } catch {
      toast.error("Failed to get suggestions");
    } finally {
      setSuggesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingDots />
      </div>
    );
  }

  const grouped = CATEGORIES.reduce<Record<string, MemoryEntry[]>>((acc, cat) => {
    acc[cat] = entries.filter((e) => e.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Memory</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Everything Claude knows about you — injected into every conversation.
          </p>
        </div>
        <button
          onClick={refreshMemory}
          disabled={suggesting}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          {suggesting ? (
            <LoadingDots />
          ) : (
            <><RiRefreshLine className="w-4 h-4" /> Refresh</>
          )}
        </button>
      </div>

      {/* Category groups */}
      {CATEGORIES.map((cat) => (
        <div key={cat} className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text-primary text-sm">{cat}</h2>
            <button
              onClick={() => setAddingCategory(cat)}
              className="text-xs text-accent hover:text-accent-text flex items-center gap-1"
            >
              <RiAddLine className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <div className="space-y-2">
            {grouped[cat].length === 0 && addingCategory !== cat && (
              <p className="text-xs text-text-muted italic">No entries yet.</p>
            )}

            {grouped[cat].map((entry) =>
              editingId === entry.id ? (
                // Edit mode row
                <div key={entry.id} className="flex items-center gap-2">
                  <input
                    className="input-base flex-1 text-sm py-1.5"
                    value={editValues.key}
                    onChange={(e) => setEditValues((p) => ({ ...p, key: e.target.value }))}
                    placeholder="Key"
                  />
                  <input
                    className="input-base flex-[2] text-sm py-1.5"
                    value={editValues.value}
                    onChange={(e) => setEditValues((p) => ({ ...p, value: e.target.value }))}
                    placeholder="Value"
                  />
                  <button onClick={() => saveEdit(entry.id)} className="text-success hover:text-success/80 p-1">
                    <RiCheckLine className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-text-muted hover:text-text-secondary p-1">
                    <RiCloseLine className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                // Display row
                <div
                  key={entry.id}
                  className="flex items-center gap-2 group px-1 py-1 rounded-lg hover:bg-bg-tertiary transition-colors"
                >
                  <span className="text-sm text-text-secondary w-36 shrink-0">{entry.key}</span>
                  <span className="text-sm text-text-primary flex-1 min-w-0 truncate">
                    {entry.value || <em className="text-text-muted">empty</em>}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(entry)}
                      className="p-1 text-text-muted hover:text-accent"
                    >
                      <RiEditLine className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-1 text-text-muted hover:text-danger"
                    >
                      <RiDeleteBinLine className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Add new entry form */}
            {addingCategory === cat && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  className="input-base flex-1 text-sm py-1.5"
                  value={newEntry.key}
                  onChange={(e) => setNewEntry((p) => ({ ...p, key: e.target.value }))}
                  placeholder="Key (e.g. Hobby)"
                  autoFocus
                />
                <input
                  className="input-base flex-[2] text-sm py-1.5"
                  value={newEntry.value}
                  onChange={(e) => setNewEntry((p) => ({ ...p, value: e.target.value }))}
                  placeholder="Value"
                  onKeyDown={(e) => e.key === "Enter" && addEntry(cat)}
                />
                <button onClick={() => addEntry(cat)} className="text-success hover:text-success/80 p-1">
                  <RiCheckLine className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setAddingCategory(null); setNewEntry({ key: "", value: "" }); }}
                  className="text-text-muted hover:text-text-secondary p-1"
                >
                  <RiCloseLine className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

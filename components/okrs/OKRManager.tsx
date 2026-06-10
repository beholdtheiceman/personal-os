"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Objective } from "@/types";
import ObjectiveCard from "./ObjectiveCard";
import { RiAddLine, RiRefreshLine } from "react-icons/ri";

function currentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

const QUARTERS = (() => {
  const now = new Date();
  const year = now.getFullYear();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const list: string[] = [];
  for (let i = 0; i < 4; i++) {
    let qq = q - i;
    let yy = year;
    while (qq <= 0) { qq += 4; yy--; }
    list.push(`${yy}-Q${qq}`);
  }
  return list;
})();

export default function OKRManager() {
  const { user } = useAuth();
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [quarter, setQuarter] = useState(currentQuarter());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/okrs`), orderBy("created_at", "desc"));
    return onSnapshot(q, (snap) => {
      setObjectives(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Objective)));
    });
  }, [user]);

  const filtered = objectives.filter((o) => o.quarter === quarter);
  const active = filtered.filter((o) => o.status === "active");
  const done = filtered.filter((o) => o.status !== "active");

  const addObjective = async () => {
    if (!user || !form.title.trim()) return;
    const id = crypto.randomUUID();
    await setDoc(doc(db, `users/${user.uid}/okrs/${id}`), {
      title: form.title.trim(),
      description: form.description.trim(),
      quarter,
      keyResults: [],
      status: "active",
      created_at: new Date().toISOString(),
    });
    setForm({ title: "", description: "" });
    setShowForm(false);
  };

  const updateObjective = async (id: string, updates: Partial<Objective>) => {
    if (!user) return;
    await updateDoc(doc(db, `users/${user.uid}/okrs/${id}`), updates as Record<string, unknown>);
  };

  const deleteObjective = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/okrs/${id}`));
  };

  const generateReview = async (objectiveId: string) => {
    if (!user) return;
    setGenerating(objectiveId);
    try {
      const idToken = await user.getIdToken();
      await fetch("/api/okrs/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ objectiveId }),
      });
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 flex-wrap">
          {QUARTERS.map((q) => (
            <button
              key={q}
              onClick={() => setQuarter(q)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                quarter === q
                  ? "bg-accent/80 border-accent text-white"
                  : "border-bg-border text-text-secondary hover:border-accent/50"
              }`}
            >
              {q}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/80 hover:bg-accent text-white text-xs font-medium rounded-lg transition-colors shrink-0"
        >
          <RiAddLine className="w-3.5 h-3.5" /> Add Objective
        </button>
      </div>

      {active.length === 0 && !showForm && (
        <div className="card border-dashed border-accent/30 text-center py-8">
          <p className="text-sm text-text-secondary mb-3">No objectives for {quarter} yet.</p>
          <a
            href="/chat"
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium rounded-lg transition-colors"
          >
            Plan {quarter} with Claude →
          </a>
        </div>
      )}

      {showForm && (
        <div className="card border border-accent/30">
          <p className="text-sm font-semibold text-text-primary mb-3">New Objective — {quarter}</p>
          <div className="space-y-2">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Objective (e.g. Become the healthiest version of myself)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-bg-border bg-bg-secondary text-text-primary focus:border-accent outline-none"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void addObjective()}
            />
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Why this matters (optional)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-bg-border bg-bg-secondary text-text-primary focus:border-accent outline-none"
            />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => void addObjective()} className="px-3 py-1.5 bg-accent/80 text-white text-xs font-medium rounded-lg hover:bg-accent transition-colors">
              Create
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {active.map((obj) => (
          <div key={obj.id}>
            <ObjectiveCard objective={obj} onUpdate={updateObjective} onDelete={deleteObjective} />
            {!obj.review && (
              <button
                onClick={() => generateReview(obj.id)}
                disabled={generating === obj.id}
                className="mt-1 ml-7 flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors disabled:opacity-40"
              >
                <RiRefreshLine className={`w-3 h-3 ${generating === obj.id ? "animate-spin" : ""}`} />
                {generating === obj.id ? "Generating review…" : "Generate Q review"}
              </button>
            )}
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Completed / Abandoned</p>
          <div className="space-y-3">
            {done.map((obj) => (
              <ObjectiveCard key={obj.id} objective={obj} onUpdate={updateObjective} onDelete={deleteObjective} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

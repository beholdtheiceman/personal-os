"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from "firebase/firestore";
import { RiAddLine, RiLineChartLine } from "react-icons/ri";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import GoalCard from "./GoalCard";
import GoalForm from "./GoalForm";
import type { Goal, GoalCategory } from "@/types";

const STATUS_TABS = ["active", "achieved", "paused"] as const;
const CATEGORY_FILTERS: (GoalCategory | "all")[] = ["all", "personal", "business", "health", "financial"];

export default function GoalsManager() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [statusTab, setStatusTab] = useState<typeof STATUS_TABS[number]>("active");
  const [categoryFilter, setCategoryFilter] = useState<GoalCategory | "all">("all");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "goals"), orderBy("created_at", "desc"));
    return onSnapshot(q, (snap) => {
      setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Goal)));
    });
  }, [user]);

  const handleSave = async (data: Partial<Goal>) => {
    if (!user) return;
    if (editing) {
      await updateDoc(doc(db, "users", user.uid, "goals", editing.id), {
        ...data,
        updated_at: Timestamp.now(),
      });
    } else {
      await addDoc(collection(db, "users", user.uid, "goals"), {
        ...data,
        status: "active",
        created_at: Timestamp.now(),
      });
    }
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "goals", id));
  };

  const handleStatusChange = async (id: string, status: Goal["status"]) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "goals", id), { status });
  };

  const handleToggleMilestone = async (goalId: string, idx: number) => {
    if (!user) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    const milestones = goal.milestones.map((m, i) =>
      i === idx ? { ...m, completed: !m.completed } : m
    );
    await updateDoc(doc(db, "users", user.uid, "goals", goalId), { milestones });
  };

  const filtered = goals.filter(
    (g) => g.status === statusTab && (categoryFilter === "all" || g.category === categoryFilter)
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`text-xs px-3 py-1.5 rounded-md capitalize transition-colors ${
                statusTab === tab ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab}
              <span className="ml-1.5 text-[10px] opacity-70">
                {goals.filter((g) => g.status === tab).length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as GoalCategory | "all")}
            className="input-base text-xs py-1.5 w-auto"
          >
            {CATEGORY_FILTERS.map((c) => (
              <option key={c} value={c}>{c === "all" ? "All categories" : c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-1.5">
            <RiAddLine className="w-4 h-4" /> New Goal
          </button>
        </div>
      </div>

      {/* Goal grid */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <RiLineChartLine className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary text-sm">
            {statusTab === "active" ? "No active goals yet — add one to get started." : `No ${statusTab} goals.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onToggleMilestone={handleToggleMilestone}
              onEdit={(g) => { setEditing(g); setShowForm(true); }}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {showForm && (
        <GoalForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

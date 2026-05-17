"use client";
// Full task manager — list/kanban views, AI scoring, real-time Firestore sync
import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addUserDoc } from "@/lib/firestore-helpers";
import { useAuth } from "@/contexts/AuthContext";
import TaskCard from "./TaskCard";
import TaskForm from "./TaskForm";
import LoadingDots from "@/components/ui/LoadingDots";
import {
  RiAddLine, RiListCheck, RiLayoutColumnLine, RiFilterLine,
} from "react-icons/ri";
import toast from "react-hot-toast";
import type { Task, TaskStatus, TaskTag } from "@/types";

type View = "list" | "kanban";
type Filter = "all" | TaskStatus | TaskTag;

const KANBAN_COLS: { id: TaskStatus; label: string }[] = [
  { id: "active",    label: "To Do" },
  { id: "completed", label: "Done" },
];

export default function TasksManager() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Real-time listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "tasks"),
      orderBy("priority_score", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    }, (err) => {
      console.error("Tasks listener error:", err);
      toast.error("Failed to load tasks");
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const addTask = async (data: Partial<Task>) => {
    if (!user) return;
    await addUserDoc(user.uid, "tasks", {
      ...data,
      status: "active",
    });
    toast.success("Task added");
  };

  const updateTask = async (id: string, data: Partial<Task>) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "tasks", id), data);
    toast.success("Task updated");
  };

  const completeTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task || !user) return;
    const newStatus: TaskStatus = task.status === "completed" ? "active" : "completed";
    await updateDoc(doc(db, "users", user.uid, "tasks", id), { status: newStatus });
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "tasks", id));
    toast.success("Task deleted");
  };

  // Filtered task list
  const filtered = tasks.filter((t) => {
    if (filter === "all") return t.status !== "archived";
    if (["active", "completed", "archived"].includes(filter)) return t.status === filter;
    return t.tags.includes(filter as TaskTag) && t.status !== "archived";
  });

  const forStatus = (status: TaskStatus) =>
    filtered.filter((t) => t.status === status);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingDots />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Tasks</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {tasks.filter((t) => t.status === "active").length} active ·{" "}
            {tasks.filter((t) => t.status === "completed").length} completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-bg-secondary border border-bg-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={`p-2 transition-colors ${view === "list" ? "bg-accent/20 text-accent" : "text-text-secondary hover:text-text-primary"}`}
              title="List view"
            >
              <RiListCheck className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`p-2 transition-colors ${view === "kanban" ? "bg-accent/20 text-accent" : "text-text-secondary hover:text-text-primary"}`}
              title="Kanban view"
            >
              <RiLayoutColumnLine className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <RiAddLine className="w-4 h-4" /> New Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "active", "completed", "personal", "business", "health", "finance"] as Filter[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
                filter === f
                  ? "bg-accent/20 border-accent/40 text-accent-text"
                  : "border-bg-border text-text-secondary hover:border-accent/30"
              }`}
            >
              {f}
            </button>
          )
        )}
      </div>

      {/* ── List View ── */}
      {view === "list" && (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-text-secondary text-sm mb-3">No tasks here.</p>
              <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
                Add your first task
              </button>
            </div>
          ) : (
            filtered.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={completeTask}
                onDelete={deleteTask}
                onEdit={(t) => setEditingTask(t)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Kanban View ── */}
      {view === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KANBAN_COLS.map(({ id, label }) => (
            <div key={id} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
                <span className="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded-full">
                  {forStatus(id).length}
                </span>
              </div>
              <div className="space-y-2">
                {forStatus(id).length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-4">Empty</p>
                ) : (
                  forStatus(id).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={completeTask}
                      onDelete={deleteTask}
                      onEdit={(t) => setEditingTask(t)}
                      compact
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modals */}
      {showForm && (
        <TaskForm
          onSave={addTask}
          onClose={() => setShowForm(false)}
        />
      )}
      {editingTask && (
        <TaskForm
          initial={editingTask}
          onSave={(data) => updateTask(editingTask.id, data)}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}

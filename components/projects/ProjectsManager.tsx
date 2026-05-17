"use client";
import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from "firebase/firestore";
import { RiAddLine, RiFolderLine, RiEditLine, RiDeleteBinLine } from "react-icons/ri";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import ProjectForm from "./ProjectForm";
import KanbanBoard from "./KanbanBoard";
import type { Project } from "@/types";

const STATUS_COLORS: Record<Project["status"], string> = {
  "active":    "bg-success/15 text-success",
  "on-hold":   "bg-warning/15 text-warning",
  "completed": "bg-bg-tertiary text-text-muted",
};

export default function ProjectsManager() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "projects"), orderBy("created_at", "desc"));
    return onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)));
    });
  }, [user]);

  const handleSave = async (data: Partial<Project>) => {
    if (!user) return;
    if (editing) {
      await updateDoc(doc(db, "users", user.uid, "projects", editing.id), data);
    } else {
      await addDoc(collection(db, "users", user.uid, "projects"), {
        ...data,
        created_at: Timestamp.now(),
      });
    }
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "projects", id));
    if (selected?.id === id) setSelected(null);
  };

  const handleStatusChange = async (id: string, status: Project["status"]) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "projects", id), { status });
  };

  if (selected) {
    return <KanbanBoard project={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-1.5">
          <RiAddLine className="w-4 h-4" /> New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <RiFolderLine className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary text-sm">No projects yet — create one to get a Kanban board.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const isCompleted = p.status === "completed";
            return (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className="card cursor-pointer hover:border-accent/30 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: p.color_tag }} />
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold text-text-primary truncate ${isCompleted ? "line-through opacity-60" : ""}`}>
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{p.description}</p>
                    )}
                    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-2 ${STATUS_COLORS[p.status]}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditing(p); setShowForm(true); }}
                      className="p-1 text-text-muted hover:text-accent rounded"
                    >
                      <RiEditLine className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1 text-text-muted hover:text-danger rounded">
                      <RiDeleteBinLine className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Status toggle */}
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-bg-border" onClick={(e) => e.stopPropagation()}>
                  {(["active", "on-hold", "completed"] as Project["status"][]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(p.id, s)}
                      className={`text-[10px] px-2 py-1 rounded capitalize transition-colors ${
                        p.status === s ? STATUS_COLORS[s] : "text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProjectForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

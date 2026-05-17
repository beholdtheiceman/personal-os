"use client";
import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, Timestamp } from "firebase/firestore";
import { RiAddLine, RiDeleteBinLine, RiEditLine, RiArrowLeftLine } from "react-icons/ri";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import CardForm from "./CardForm";
import type { Project, KanbanCard, KanbanStatus } from "@/types";

const COLUMNS: { id: KanbanStatus; label: string; color: string }[] = [
  { id: "todo",        label: "To Do",       color: "text-text-secondary" },
  { id: "in_progress", label: "In Progress",  color: "text-warning" },
  { id: "done",        label: "Done",         color: "text-success" },
];

const PRIORITY_DOT: Record<KanbanCard["priority"], string> = {
  low:    "bg-info",
  medium: "bg-warning",
  high:   "bg-danger",
};

interface KanbanBoardProps {
  project: Project;
  onBack: () => void;
}

export default function KanbanBoard({ project, onBack }: KanbanBoardProps) {
  const { user } = useAuth();
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [showForm, setShowForm] = useState<KanbanStatus | null>(null);
  const [editing, setEditing] = useState<KanbanCard | null>(null);
  const dragCard = useRef<KanbanCard | null>(null);

  const colPath = `users/${user?.uid}/projects/${project.id}/cards`;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, colPath), orderBy("created_at", "asc"));
    return onSnapshot(q, (snap) => {
      setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() } as KanbanCard)));
    });
  }, [user, project.id]);

  const handleSave = async (data: Partial<KanbanCard>) => {
    if (!user) return;
    if (editing) {
      await updateDoc(doc(db, colPath, editing.id), data);
    } else {
      await addDoc(collection(db, colPath), { ...data, created_at: Timestamp.now() });
    }
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, colPath, id));
  };

  const moveCard = async (card: KanbanCard, newStatus: KanbanStatus) => {
    if (!user || card.status === newStatus) return;
    await updateDoc(doc(db, colPath, card.id), { status: newStatus });
  };

  const onDragStart = (card: KanbanCard) => { dragCard.current = card; };
  const onDrop = async (status: KanbanStatus) => {
    if (dragCard.current) await moveCard(dragCard.current, status);
    dragCard.current = null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors">
          <RiArrowLeftLine className="w-4 h-4" />
        </button>
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color_tag }} />
        <div>
          <h2 className="text-base font-semibold text-text-primary">{project.name}</h2>
          {project.description && <p className="text-xs text-text-muted">{project.description}</p>}
        </div>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.status === col.id);
          return (
            <div
              key={col.id}
              className="bg-bg-secondary rounded-xl p-3 min-h-[400px] flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                  <span className="text-[10px] bg-bg-tertiary text-text-muted px-1.5 py-0.5 rounded-full">
                    {colCards.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowForm(col.id)}
                  className="p-1 text-text-muted hover:text-accent rounded transition-colors"
                >
                  <RiAddLine className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2">
                {colCards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => onDragStart(card)}
                    className="bg-bg-primary border border-bg-border rounded-lg p-3 cursor-grab active:cursor-grabbing group hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[card.priority]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-text-primary leading-snug">{card.title}</p>
                        {card.description && (
                          <p className="text-[11px] text-text-muted mt-1 leading-relaxed line-clamp-2">{card.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => { setEditing(card); setShowForm(card.status); }}
                          className="p-0.5 text-text-muted hover:text-accent"
                        >
                          <RiEditLine className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(card.id)} className="p-0.5 text-text-muted hover:text-danger">
                          <RiDeleteBinLine className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Move buttons */}
                    <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {COLUMNS.filter((c) => c.id !== col.id).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => moveCard(card, c.id)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-bg-secondary text-text-muted hover:text-text-primary transition-colors"
                        >
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add card button at bottom */}
              <button
                onClick={() => setShowForm(col.id)}
                className="mt-2 w-full py-2 text-xs text-text-muted hover:text-text-secondary border border-dashed border-bg-border hover:border-accent/30 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <RiAddLine className="w-3.5 h-3.5" /> Add card
              </button>
            </div>
          );
        })}
      </div>

      {showForm && (
        <CardForm
          initial={editing ?? undefined}
          defaultStatus={showForm}
          onSave={handleSave}
          onClose={() => { setShowForm(null); setEditing(null); }}
        />
      )}
    </div>
  );
}

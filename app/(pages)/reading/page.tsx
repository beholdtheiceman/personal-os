"use client";
import { useState } from "react";
import { useBooks } from "@/hooks/useBooks";
import BookCard from "@/components/reading/BookCard";
import BookForm from "@/components/reading/BookForm";
import type { Book, BookStatus } from "@/types";
import { RiAddLine, RiBookLine, RiSearchLine } from "react-icons/ri";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Tab = "reading" | "want_to_read" | "finished" | "abandoned" | "all";

const TABS: { key: Tab; label: string; color: string }[] = [
  { key: "reading",      label: "Reading",      color: "text-yellow-400" },
  { key: "want_to_read", label: "Want to Read",  color: "text-blue-400" },
  { key: "finished",     label: "Finished",      color: "text-green-400" },
  { key: "abandoned",    label: "Abandoned",     color: "text-gray-400" },
  { key: "all",          label: "All",           color: "text-text-primary" },
];

function SortableBookCard(props: React.ComponentProps<typeof BookCard>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.book.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }}
    >
      <BookCard
        {...props}
        dragHandleListeners={listeners as Record<string, unknown>}
        dragHandleAttributes={attributes as unknown as Record<string, unknown>}
      />
    </div>
  );
}

export default function ReadingPage() {
  const {
    books, reading, wantToRead, finished, abandoned, loading,
    addBook, updateBook, deleteBook, addHighlight, removeHighlight, reorderBooks,
  } = useBooks();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = wantToRead.findIndex((b) => b.id === active.id);
    const newIndex = wantToRead.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderBooks(arrayMove(wantToRead, oldIndex, newIndex).map((b) => b.id));
  };

  const [tab,     setTab]     = useState<Tab>("reading");
  const [search,  setSearch]  = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<Book | null>(null);

  if (loading) return <div className="p-6 text-text-muted text-sm">Loading…</div>;

  const listForTab = (): Book[] => {
    const base = tab === "reading"      ? reading
               : tab === "want_to_read" ? wantToRead
               : tab === "finished"     ? finished
               : tab === "abandoned"    ? abandoned
               : books;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.tags?.some((t) => t.toLowerCase().includes(q))
    );
  };

  const displayBooks = listForTab();

  const handleSave = async (data: Omit<Book, "id" | "created_at" | "updated_at" | "highlights">) => {
    if (editing) {
      await updateBook(editing.id, data);
      setEditing(null);
    } else {
      await addBook(data);
      setShowForm(false);
    }
  };

  const handleStatusAdvance = async (book: Book) => {
    const next: Partial<Record<BookStatus, BookStatus>> = {
      want_to_read: "reading",
      reading:      "finished",
    };
    const n = next[book.status];
    if (n) await updateBook(book.id, { status: n });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Reading List</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {reading.length} reading · {wantToRead.length} want to read · {finished.length} finished
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary text-sm py-1.5 flex items-center gap-1.5"
        >
          <RiAddLine className="w-4 h-4" /> Add Book
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(({ key, label, color }) => {
          const count = key === "reading" ? reading.length
                      : key === "want_to_read" ? wantToRead.length
                      : key === "finished" ? finished.length
                      : key === "abandoned" ? abandoned.length
                      : books.length;
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                isActive
                  ? "bg-bg-secondary border-accent/50 text-accent"
                  : "bg-bg-secondary/90 border-white/15 hover:border-white/30"
              }`}
            >
              <span className={isActive ? "text-accent" : color}>{label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-accent/20 text-accent" : "bg-white/10 text-text-muted"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search books…"
          className="input-base text-sm pl-9 w-full"
        />
      </div>

      {/* Book list */}
      {displayBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <RiBookLine className="w-10 h-10 text-text-muted/40" />
          <p className="text-sm text-text-muted">
            {search ? "No books match your search." : `No books in ${tab === "all" ? "your library" : `'${TABS.find((t) => t.key === tab)?.label}'`} yet.`}
          </p>
          {!search && (
            <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary text-sm py-1.5">
              Add your first book
            </button>
          )}
        </div>
      ) : tab === "want_to_read" && !search ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayBooks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {displayBooks.map((book) => (
                <SortableBookCard
                  key={book.id}
                  book={book}
                  onEdit={() => setEditing(book)}
                  onDelete={() => deleteBook(book.id)}
                  onStatusAdvance={() => handleStatusAdvance(book)}
                  onAddHighlight={(text) => addHighlight(book.id, text)}
                  onRemoveHighlight={(i) => removeHighlight(book.id, i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onEdit={() => setEditing(book)}
              onDelete={() => deleteBook(book.id)}
              onStatusAdvance={() => handleStatusAdvance(book)}
              onAddHighlight={(text) => addHighlight(book.id, text)}
              onRemoveHighlight={(i) => removeHighlight(book.id, i)}
            />
          ))}
        </div>
      )}

      {/* Forms */}
      {(showForm || editing) && (
        <BookForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

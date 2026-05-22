"use client";
import { useState } from "react";
import {
  RiEditLine, RiDeleteBinLine, RiAddLine, RiStarFill,
  RiArrowRightLine, RiFileTextLine, RiPriceTag3Line, RiDeleteBin2Line,
} from "react-icons/ri";
import Image from "next/image";
import type { Book, BookStatus } from "@/types";

const STATUS_NEXT: Partial<Record<BookStatus, BookStatus>> = {
  want_to_read: "reading",
  reading:      "finished",
};
const STATUS_NEXT_LABEL: Partial<Record<BookStatus, string>> = {
  want_to_read: "Start Reading",
  reading:      "Mark Finished",
};

const STATUS_COLORS: Record<BookStatus, string> = {
  want_to_read: "bg-blue-500/15 text-blue-400",
  reading:      "bg-yellow-500/15 text-yellow-400",
  finished:     "bg-green-500/15 text-green-400",
  abandoned:    "bg-gray-500/15 text-gray-400",
};
const STATUS_LABELS: Record<BookStatus, string> = {
  want_to_read: "Want to Read",
  reading:      "Reading",
  finished:     "Finished",
  abandoned:    "Abandoned",
};

interface Props {
  book: Book;
  onEdit: () => void;
  onDelete: () => void;
  onStatusAdvance: () => void;
  onAddHighlight: (text: string) => void;
  onRemoveHighlight: (index: number) => void;
}

export default function BookCard({
  book, onEdit, onDelete, onStatusAdvance, onAddHighlight, onRemoveHighlight,
}: Props) {
  const [expanded,     setExpanded]     = useState(false);
  const [newHighlight, setNewHighlight] = useState("");
  const [addingHL,     setAddingHL]     = useState(false);

  const submitHighlight = () => {
    const text = newHighlight.trim();
    if (!text) return;
    onAddHighlight(text);
    setNewHighlight("");
    setAddingHL(false);
  };

  const nextStatus = STATUS_NEXT[book.status];

  return (
    <div className="card p-3 space-y-2">
      {/* Header */}
      <div className="flex gap-3">
        {book.cover_url && (
          <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden">
            <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="flex-1 min-w-0">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-sm font-semibold text-text-primary hover:text-accent text-left leading-snug"
              >
                {book.title}
              </button>
              <p className="text-xs text-text-muted">{book.author}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {nextStatus && (
                <button
                  onClick={onStatusAdvance}
                  title={STATUS_NEXT_LABEL[book.status]}
                  className="btn-ghost p-1.5 text-accent hover:text-accent/80"
                >
                  <RiArrowRightLine className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={onEdit} className="btn-ghost p-1.5"><RiEditLine className="w-3.5 h-3.5" /></button>
              <button onClick={onDelete} className="btn-ghost p-1.5 text-danger hover:text-danger/80"><RiDeleteBinLine className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${STATUS_COLORS[book.status]}`}>
              {STATUS_LABELS[book.status]}
            </span>
            {book.rating != null && (
              <span className="flex items-center gap-0.5 text-xs text-yellow-400">
                <RiStarFill className="w-3 h-3" /> {book.rating}/10
              </span>
            )}
            {book.start_date && (
              <span className="text-xs text-text-muted">
                {book.status === "reading" ? "Started " : "Read "}
                {book.start_date}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="pt-2 border-t border-bg-border space-y-3">
          {(book.tags?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <RiPriceTag3Line className="w-3.5 h-3.5 text-text-muted" />
              {book.tags!.map((tag) => (
                <span key={tag} className="text-xs bg-bg-tertiary text-text-muted px-1.5 py-0.5 rounded-md">{tag}</span>
              ))}
            </div>
          )}

          {book.takeaways && (
            <div className="flex gap-2">
              <RiFileTextLine className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />
              <p className="text-xs text-text-secondary">{book.takeaways}</p>
            </div>
          )}

          {/* Highlights */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted font-medium">Highlights ({book.highlights.length})</span>
              <button
                onClick={() => setAddingHL((v) => !v)}
                className="text-xs text-accent hover:text-accent/80 flex items-center gap-1"
              >
                <RiAddLine className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {addingHL && (
              <div className="flex gap-2">
                <input
                  value={newHighlight}
                  onChange={(e) => setNewHighlight(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitHighlight(); if (e.key === "Escape") setAddingHL(false); }}
                  placeholder="Paste highlight…"
                  className="input-base text-xs flex-1"
                  autoFocus
                />
                <button onClick={submitHighlight} className="btn-primary text-xs px-2 py-1">Save</button>
              </div>
            )}
            {book.highlights.length === 0 && !addingHL && (
              <p className="text-xs text-text-muted italic">No highlights yet.</p>
            )}
            {book.highlights.map((hl, i) => (
              <div key={i} className="group flex gap-2 items-start bg-bg-tertiary rounded-lg p-2">
                <p className="text-xs text-text-secondary flex-1 leading-relaxed">{hl}</p>
                <button
                  onClick={() => onRemoveHighlight(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <RiDeleteBin2Line className="w-3.5 h-3.5 text-text-muted hover:text-danger" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-text-muted hover:text-text-secondary"
      >
        {expanded ? "Hide details" : "Show details"}
      </button>
    </div>
  );
}

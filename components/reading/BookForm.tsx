"use client";
import { useState } from "react";
import { RiCheckLine, RiCloseLine } from "react-icons/ri";
import type { Book, BookStatus } from "@/types";
import toast from "react-hot-toast";

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: "want_to_read", label: "Want to Read" },
  { value: "reading",      label: "Reading" },
  { value: "finished",     label: "Finished" },
  { value: "abandoned",    label: "Abandoned" },
];

interface Props {
  initial?: Partial<Book>;
  onSave: (data: Omit<Book, "id" | "created_at" | "updated_at" | "highlights">) => Promise<void>;
  onCancel: () => void;
}

export default function BookForm({ initial, onSave, onCancel }: Props) {
  const [title,     setTitle]     = useState(initial?.title ?? "");
  const [author,    setAuthor]    = useState(initial?.author ?? "");
  const [status,    setStatus]    = useState<BookStatus>(initial?.status ?? "want_to_read");
  const [rating,    setRating]    = useState(String(initial?.rating ?? ""));
  const [coverUrl,  setCoverUrl]  = useState(initial?.cover_url ?? "");
  const [tags,      setTags]      = useState((initial?.tags ?? []).join(", "));
  const [takeaways, setTakeaways] = useState(initial?.takeaways ?? "");
  const [saving,    setSaving]    = useState(false);

  const handleSave = async () => {
    if (!title.trim())  return toast.error("Title is required");
    if (!author.trim()) return toast.error("Author is required");
    setSaving(true);
    await onSave({
      title:     title.trim(),
      author:    author.trim(),
      status,
      rating:    rating ? parseInt(rating) : undefined,
      cover_url: coverUrl || undefined,
      tags:      tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      takeaways: takeaways || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            {initial?.title ? "Edit Book" : "Add Book"}
          </h3>
          <button onClick={onCancel} className="btn-ghost p-1"><RiCloseLine className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted mb-1 block">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" className="input-base text-sm" autoFocus />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Author *</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" className="input-base text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as BookStatus)} className="input text-sm">
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Rating (1–10)</label>
              <input type="number" min="1" max="10" value={rating} onChange={(e) => setRating(e.target.value)} placeholder="8" className="input-base text-sm" />
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Cover URL (optional)</label>
            <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." className="input-base text-sm" />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Tags (comma-separated)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="non-fiction, business" className="input-base text-sm" />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Key Takeaways</label>
            <textarea value={takeaways} onChange={(e) => setTakeaways(e.target.value)} rows={2} placeholder="What did you learn?" className="input-base text-sm resize-none" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-1.5 flex items-center gap-1.5">
            <RiCheckLine className="w-4 h-4" />
            {saving ? "Saving…" : initial?.title ? "Update" : "Add Book"}
          </button>
          <button onClick={onCancel} className="btn-ghost text-sm py-1.5">Cancel</button>
        </div>
      </div>
    </div>
  );
}

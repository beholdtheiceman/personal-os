"use client";
import { useState } from "react";
import { RiCheckLine, RiCloseLine, RiAddLine, RiDeleteBinLine } from "react-icons/ri";
import type { PodcastEpisode, EpisodeStatus, EpisodeLink } from "@/types";
import toast from "react-hot-toast";

const STATUS_OPTIONS: { value: EpisodeStatus; label: string }[] = [
  { value: "idea",      label: "Idea" },
  { value: "outlined",  label: "Outlined" },
  { value: "recorded",  label: "Recorded" },
  { value: "edited",    label: "Edited" },
  { value: "published", label: "Published" },
];

interface Props {
  initial?: Partial<PodcastEpisode>;
  onSave: (data: Omit<PodcastEpisode, "id" | "created_at" | "updated_at">) => Promise<void>;
  onCancel: () => void;
}

export default function EpisodeForm({ initial, onSave, onCancel }: Props) {
  const [title, setTitle]         = useState(initial?.title ?? "");
  const [epNum, setEpNum]         = useState(String(initial?.episode_number ?? ""));
  const [status, setStatus]       = useState<EpisodeStatus>(initial?.status ?? "idea");
  const [recordDate, setRecord]   = useState(initial?.record_date ?? "");
  const [publishDate, setPublish] = useState(initial?.publish_date ?? "");
  const [description, setDesc]    = useState(initial?.description ?? "");
  const [notes, setNotes]         = useState(initial?.notes ?? "");
  const [tags, setTags]           = useState((initial?.tags ?? []).join(", "));
  const [links, setLinks]         = useState<EpisodeLink[]>(initial?.links ?? []);
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return toast.error("Title is required");
    setSaving(true);
    await onSave({
      title: title.trim(),
      episode_number: epNum ? parseInt(epNum) : undefined,
      status,
      record_date:  recordDate  || undefined,
      publish_date: publishDate || undefined,
      description:  description || undefined,
      notes:        notes       || undefined,
      tags:         tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      links:        links.filter((l) => l.url),
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="card w-full max-w-lg space-y-4 my-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            {initial?.title ? "Edit Episode" : "New Episode"}
          </h3>
          <button onClick={onCancel} className="btn-ghost p-1"><RiCloseLine className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-text-muted mb-1 block">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode title" className="input-base text-sm" autoFocus />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Episode #</label>
            <input type="number" value={epNum} onChange={(e) => setEpNum(e.target.value)} placeholder="42" className="input-base text-sm" />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as EpisodeStatus)} className="input text-sm">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Record date</label>
            <input type="date" value={recordDate} onChange={(e) => setRecord(e.target.value)} className="input-base text-sm" />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1 block">Publish date</label>
            <input type="date" value={publishDate} onChange={(e) => setPublish(e.target.value)} className="input-base text-sm" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-muted mb-1 block">Description</label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Episode summary..." className="input-base text-sm resize-none" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-muted mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Production notes..." className="input-base text-sm resize-none" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-text-muted mb-1 block">Tags (comma-separated)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="interview, solo, gear" className="input-base text-sm" />
          </div>
          <div className="col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-muted">Links</label>
              <button onClick={() => setLinks([...links, { label: "", url: "" }])} className="text-xs text-accent hover:text-accent/80 flex items-center gap-1">
                <RiAddLine className="w-3.5 h-3.5" /> Add link
              </button>
            </div>
            {links.map((link, i) => (
              <div key={i} className="flex gap-2">
                <input value={link.label} onChange={(e) => setLinks(links.map((l, j) => j === i ? { ...l, label: e.target.value } : l))} placeholder="Label" className="input-base text-xs w-28 shrink-0" />
                <input value={link.url} onChange={(e) => setLinks(links.map((l, j) => j === i ? { ...l, url: e.target.value } : l))} placeholder="https://..." className="input-base text-xs flex-1" />
                <button onClick={() => setLinks(links.filter((_, j) => j !== i))} className="btn-ghost p-1.5 shrink-0"><RiDeleteBinLine className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-1.5 flex items-center gap-1.5">
            <RiCheckLine className="w-4 h-4" />
            {saving ? "Saving..." : initial?.title ? "Update" : "Create"}
          </button>
          <button onClick={onCancel} className="btn-ghost text-sm py-1.5">Cancel</button>
        </div>
      </div>
    </div>
  );
}

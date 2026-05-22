"use client";
import { useState } from "react";
import { usePodcast } from "@/hooks/usePodcast";
import EpisodeCard from "@/components/content/EpisodeCard";
import EpisodeForm from "@/components/content/EpisodeForm";
import ContentCalendar from "@/components/content/ContentCalendar";
import type { PodcastEpisode, EpisodeStatus } from "@/types";
import { RiAddLine, RiLayoutColumnLine, RiCalendarLine, RiListCheck } from "react-icons/ri";

type Tab = "pipeline" | "calendar" | "all";

const STATUS_ORDER: EpisodeStatus[] = ["idea", "outlined", "recorded", "edited", "published"];
const STATUS_LABELS: Record<EpisodeStatus, string> = {
  idea:      "Ideas",
  outlined:  "Outlined",
  recorded:  "Recorded",
  edited:    "Edited",
  published: "Published",
};
const STATUS_COLORS: Record<EpisodeStatus, string> = {
  idea:      "text-gray-400",
  outlined:  "text-blue-400",
  recorded:  "text-yellow-400",
  edited:    "text-purple-400",
  published: "text-green-400",
};

export default function ContentPage() {
  const { episodes, pipeline, loading, addEpisode, updateEpisode, advanceStatus, deleteEpisode } = usePodcast();
  const [tab, setTab]         = useState<Tab>("pipeline");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<PodcastEpisode | null>(null);
  const [search, setSearch]     = useState("");

  if (loading) return <div className="p-6 text-text-muted text-sm">Loading…</div>;

  const filtered = search.trim()
    ? episodes.filter(
        (e) =>
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.description?.toLowerCase().includes(search.toLowerCase()) ||
          e.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : episodes;

  const handleSave = async (data: Omit<PodcastEpisode, "id" | "created_at" | "updated_at">) => {
    if (editing) {
      await updateEpisode(editing.id, data);
      setEditing(null);
    } else {
      await addEpisode(data);
      setShowForm(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Content</h1>
          <p className="text-xs text-text-muted mt-0.5">{episodes.length} episodes total</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary text-sm py-1.5 flex items-center gap-1.5"
        >
          <RiAddLine className="w-4 h-4" /> New Episode
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-secondary rounded-xl p-1 w-fit">
        {([
          { key: "pipeline", label: "Pipeline", icon: <RiLayoutColumnLine className="w-4 h-4" /> },
          { key: "calendar", label: "Calendar",  icon: <RiCalendarLine className="w-4 h-4" /> },
          { key: "all",      label: "All",        icon: <RiListCheck className="w-4 h-4" /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-accent text-white"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Pipeline view */}
      {tab === "pipeline" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {STATUS_ORDER.map((status) => {
            const col = pipeline[status] ?? [];
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${STATUS_COLORS[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded-full">
                    {col.length}
                  </span>
                </div>
                {col.length === 0 && (
                  <div className="h-16 rounded-xl border border-dashed border-bg-border flex items-center justify-center">
                    <span className="text-xs text-text-muted">Empty</span>
                  </div>
                )}
                {col.map((ep) => (
                  <EpisodeCard
                    key={ep.id}
                    episode={ep}
                    onAdvance={() => advanceStatus(ep)}
                    onEdit={() => setEditing(ep)}
                    onDelete={() => deleteEpisode(ep.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar view */}
      {tab === "calendar" && (
        <div className="card">
          <ContentCalendar episodes={episodes} onEdit={(ep) => setEditing(ep)} />
        </div>
      )}

      {/* All episodes view */}
      {tab === "all" && (
        <div className="space-y-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search episodes…"
            className="input-base text-sm w-full max-w-sm"
          />
          {filtered.length === 0 ? (
            <p className="text-sm text-text-muted py-8 text-center">
              {search ? "No episodes match your search." : "No episodes yet."}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((ep) => (
                <EpisodeCard
                  key={ep.id}
                  episode={ep}
                  onAdvance={() => advanceStatus(ep)}
                  onEdit={() => setEditing(ep)}
                  onDelete={() => deleteEpisode(ep.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Forms */}
      {(showForm || editing) && (
        <EpisodeForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

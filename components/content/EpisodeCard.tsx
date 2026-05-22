"use client";
import { useState } from "react";
import {
  RiArrowRightLine, RiEditLine, RiDeleteBinLine, RiLinksLine,
  RiCalendarLine, RiPriceTag3Line, RiFileTextLine, RiCheckboxLine,
} from "react-icons/ri";
import type { PodcastEpisode, EpisodeStatus } from "@/types";

const STATUS_COLORS: Record<EpisodeStatus, string> = {
  idea:      "bg-gray-500/15 text-gray-400",
  outlined:  "bg-blue-500/15 text-blue-400",
  recorded:  "bg-yellow-500/15 text-yellow-400",
  edited:    "bg-purple-500/15 text-purple-400",
  published: "bg-green-500/15 text-green-400",
};

const STATUS_NEXT: Record<EpisodeStatus, string> = {
  idea:      "Mark Outlined",
  outlined:  "Mark Recorded",
  recorded:  "Mark Edited",
  edited:    "Mark Published",
  published: "",
};

interface Props {
  episode: PodcastEpisode;
  onAdvance: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function EpisodeCard({ episode, onAdvance, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasDates   = episode.record_date || episode.publish_date;
  const hasDetails = episode.description || episode.notes || (episode.tags?.length ?? 0) > 0 || (episode.links?.length ?? 0) > 0;

  return (
    <div className="card p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {episode.episode_number != null && (
              <span className="text-xs font-mono text-text-muted">#{episode.episode_number}</span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${STATUS_COLORS[episode.status]}`}>
              {episode.status.charAt(0).toUpperCase() + episode.status.slice(1)}
            </span>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-sm font-medium text-text-primary hover:text-accent text-left mt-0.5 w-full truncate"
          >
            {episode.title}
          </button>
          {hasDates && (
            <div className="flex items-center gap-3 mt-1">
              {episode.record_date && (
                <span className="text-xs text-text-muted flex items-center gap-1">
                  <RiCalendarLine className="w-3 h-3" /> Rec {episode.record_date}
                </span>
              )}
              {episode.publish_date && (
                <span className="text-xs text-text-muted flex items-center gap-1">
                  <RiCalendarLine className="w-3 h-3" /> Pub {episode.publish_date}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {episode.status !== "published" && (
            <button
              onClick={onAdvance}
              title={STATUS_NEXT[episode.status]}
              className="btn-ghost p-1.5 text-accent hover:text-accent/80"
            >
              <RiArrowRightLine className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onEdit} className="btn-ghost p-1.5"><RiEditLine className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="btn-ghost p-1.5 text-danger hover:text-danger/80"><RiDeleteBinLine className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasDetails && (
        <div className="pt-2 border-t border-bg-border space-y-2">
          {episode.description && (
            <div className="flex gap-2">
              <RiFileTextLine className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />
              <p className="text-xs text-text-secondary">{episode.description}</p>
            </div>
          )}
          {episode.notes && (
            <div className="flex gap-2">
              <RiCheckboxLine className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />
              <p className="text-xs text-text-muted italic">{episode.notes}</p>
            </div>
          )}
          {(episode.tags?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <RiPriceTag3Line className="w-3.5 h-3.5 text-text-muted" />
              {episode.tags!.map((tag) => (
                <span key={tag} className="text-xs bg-bg-tertiary text-text-muted px-1.5 py-0.5 rounded-md">{tag}</span>
              ))}
            </div>
          )}
          {(episode.links?.length ?? 0) > 0 && (
            <div className="space-y-1">
              {episode.links!.filter((l) => l.url).map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                >
                  <RiLinksLine className="w-3 h-3" />
                  {link.label || link.url}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toggle expand if there are details */}
      {hasDetails && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-text-muted hover:text-text-secondary"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      )}
    </div>
  );
}

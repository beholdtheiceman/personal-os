"use client";
import { RiBookmarkLine, RiCloseLine, RiExternalLinkLine, RiBookmarkFill, RiStarLine, RiStarFill } from "react-icons/ri";
import type { NewsItem } from "@/types";
import { formatDistanceToNow, parseISO } from "date-fns";

interface NewsCardProps {
  item: NewsItem;
  onRead:    (id: string) => void;
  onSave:    (id: string) => void;
  onDismiss: (id: string) => void;
  onStar:    (id: string, starred: boolean) => void;
}

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export default function NewsCard({ item, onRead, onSave, onDismiss, onStar }: NewsCardProps) {
  const isSaved = item.status === "saved";

  return (
    <div className="card group relative">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 text-[10px] text-text-secondary">
          <span className="font-medium">{item.feed_name}</span>
          <span>·</span>
          <span>{timeAgo(item.published_at || item.fetched_at)}</span>
        </div>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
          style={{
            background: item.relevance_score >= 8
              ? "rgba(var(--accent-rgb), 0.2)"
              : "rgba(255,255,255,0.06)",
            color: item.relevance_score >= 8 ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          {item.relevance_score}/10
        </span>
      </div>

      {/* Title */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onRead(item.id)}
        className="block text-sm font-medium text-text-primary hover:text-accent leading-snug mb-1.5"
      >
        {item.title}
      </a>

      {/* Description */}
      {item.description && (
        <p className="text-xs text-text-secondary line-clamp-2 mb-2">
          {item.description}
        </p>
      )}

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {item.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onRead(item.id)}
          className="btn-ghost text-xs flex items-center gap-1 px-2 py-1"
        >
          <RiExternalLinkLine className="w-3 h-3" /> Open
        </a>
        <button
          onClick={() => onSave(item.id)}
          className="btn-ghost text-xs flex items-center gap-1 px-2 py-1"
          title={isSaved ? "Saved" : "Save to reading list"}
        >
          {isSaved
            ? <RiBookmarkFill className="w-3 h-3 text-accent" />
            : <RiBookmarkLine className="w-3 h-3" />}
          {isSaved ? "Saved" : "Save"}
        </button>
        <button
          onClick={() => onStar(item.id, !item.starred)}
          className="btn-ghost text-xs flex items-center gap-1 px-2 py-1"
          title={item.starred ? "Unstar" : "Star article"}
        >
          {item.starred
            ? <RiStarFill className="w-3 h-3 text-yellow-400" />
            : <RiStarLine className="w-3 h-3" />}
        </button>
        <button
          onClick={() => onDismiss(item.id)}
          className="btn-ghost text-xs flex items-center gap-1 px-2 py-1 ml-auto"
          title="Dismiss"
        >
          <RiCloseLine className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

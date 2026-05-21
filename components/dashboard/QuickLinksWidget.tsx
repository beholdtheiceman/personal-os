"use client";
import { useState } from "react";
import { RiAddLine, RiPencilLine, RiDeleteBinLine, RiCheckLine, RiLink, RiExternalLinkLine } from "react-icons/ri";
import { useQuickLinks } from "@/hooks/useQuickLinks";
import type { QuickLink } from "@/types";

function getFavicon(url: string): string {
  try {
    const domain = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return "";
  }
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

export default function QuickLinksWidget() {
  const { links, loading, addLink, removeLink } = useQuickLinks();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [emoji, setEmoji] = useState("");
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const handleAdd = async () => {
    if (!title.trim() || !url.trim()) return;
    await addLink({ title: title.trim(), url: normalizeUrl(url.trim()), emoji: emoji.trim() || undefined });
    setTitle(""); setUrl(""); setEmoji(""); setAdding(false);
  };

  if (loading) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
          <RiLink className="w-3.5 h-3.5" /> Quick Links
        </h2>
        <div className="flex items-center gap-2">
          {links.length > 0 && (
            <button
              onClick={() => { setEditing((e) => !e); setAdding(false); }}
              className={`p-1.5 rounded-lg transition-colors text-xs ${editing ? "bg-accent/20 text-accent" : "text-text-muted hover:text-text-primary hover:bg-white/10"}`}
            >
              {editing ? <RiCheckLine className="w-3.5 h-3.5" /> : <RiPencilLine className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={() => { setAdding((a) => !a); setEditing(false); }}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
          >
            <RiAddLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Link grid */}
      {links.length > 0 ? (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {links.map((link) => (
            <LinkTile
              key={link.id}
              link={link}
              editing={editing}
              onRemove={() => removeLink(link.id)}
              imgError={imgErrors.has(link.id)}
              onImgError={() => setImgErrors((s) => new Set(s).add(link.id))}
            />
          ))}
        </div>
      ) : !adding ? (
        <p className="text-xs text-text-muted text-center py-4">
          No links yet.{" "}
          <button onClick={() => setAdding(true)} className="text-accent hover:text-accent/80">Add your first</button>
        </p>
      ) : null}

      {/* Add form */}
      {adding && (
        <div className="mt-3 p-3 rounded-xl space-y-2" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}>
          <p className="text-xs font-medium text-text-secondary">Add link</p>
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <input
              autoFocus
              className="input-base text-sm"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="input-base text-sm"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <input
              className="input-base text-sm text-center"
              placeholder="Emoji (opt)"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="btn-primary text-xs flex-1">Add</button>
              <button onClick={() => { setAdding(false); setTitle(""); setUrl(""); setEmoji(""); }} className="btn-ghost text-xs px-3">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkTile({
  link, editing, onRemove, imgError, onImgError,
}: {
  link: QuickLink;
  editing: boolean;
  onRemove: () => void;
  imgError: boolean;
  onImgError: () => void;
}) {
  const favicon = getFavicon(link.url);
  const showEmoji = !!link.emoji;
  const showFavicon = !showEmoji && !imgError && !!favicon;

  const inner = (
    <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl group transition-all relative"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
    >
      {/* Icon */}
      <div className="w-8 h-8 flex items-center justify-center rounded-lg overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        {showEmoji ? (
          <span className="text-lg leading-none">{link.emoji}</span>
        ) : showFavicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={favicon} alt="" width={20} height={20} className="w-5 h-5" onError={onImgError} />
        ) : (
          <RiExternalLinkLine className="w-4 h-4 text-text-muted" />
        )}
      </div>
      {/* Title */}
      <span className="text-[10px] font-medium text-text-secondary group-hover:text-text-primary transition-colors text-center leading-tight line-clamp-2 w-full">
        {link.title}
      </span>

      {/* Delete overlay in edit mode */}
      {editing && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger flex items-center justify-center shadow-md"
        >
          <RiDeleteBinLine className="w-3 h-3 text-white" />
        </button>
      )}
    </div>
  );

  if (editing) return <div className="cursor-default">{inner}</div>;

  return (
    <a href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer"
      className="block hover:scale-105 transition-transform active:scale-95"
    >
      {inner}
    </a>
  );
}

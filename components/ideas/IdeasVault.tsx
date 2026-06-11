"use client";
import { useState } from "react";
import {
  RiLightbulbLine, RiAddLine, RiDeleteBinLine, RiArrowUpLine,
  RiCheckLine, RiArchiveLine,
} from "react-icons/ri";
import { useIdeas } from "@/hooks/useIdeas";
import type { IdeaDomain, IdeaStatus, Idea } from "@/types";

const DOMAINS: { value: IdeaDomain; label: string; color: string }[] = [
  { value: "business",  label: "Business",  color: "text-blue-400" },
  { value: "creative",  label: "Creative",  color: "text-purple-400" },
  { value: "health",    label: "Health",    color: "text-green-400" },
  { value: "tech",      label: "Tech",      color: "text-cyan-400" },
  { value: "personal",  label: "Personal",  color: "text-yellow-400" },
  { value: "other",     label: "Other",     color: "text-text-muted" },
];

const STATUSES: { value: IdeaStatus | "all"; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "raw",        label: "Raw" },
  { value: "developing", label: "Developing" },
  { value: "parked",     label: "Parked" },
  { value: "promoted",   label: "Promoted" },
];

function domainColor(d: IdeaDomain) {
  return DOMAINS.find((x) => x.value === d)?.color ?? "text-text-muted";
}
function domainLabel(d: IdeaDomain) {
  return DOMAINS.find((x) => x.value === d)?.label ?? d;
}

export default function IdeasVault() {
  const { ideas, loading, addIdea, updateIdea, promoteToProject } = useIdeas();

  const [text, setText] = useState("");
  const [domain, setDomain] = useState<IdeaDomain>("other");
  const [statusFilter, setStatusFilter] = useState<IdeaStatus | "all">("all");
  const [domainFilter, setDomainFilter] = useState<IdeaDomain | "all">("all");
  const [search, setSearch] = useState("");
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteName, setPromoteName] = useState("");

  async function handleCapture() {
    if (!text.trim()) return;
    await addIdea(text.trim(), domain);
    setText("");
    setDomain("other");
  }

  const visible = ideas.filter((i) => {
    if (i.status === "discarded") return false;
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (domainFilter !== "all" && i.domain !== domainFilter) return false;
    if (search && !i.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handlePromote(idea: Idea) {
    if (!promoteName.trim()) return;
    await promoteToProject(idea.id, promoteName.trim());
    setPromotingId(null);
    setPromoteName("");
  }

  return (
    <div className="space-y-5">
      {/* Capture */}
      <div className="card space-y-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
          <RiLightbulbLine className="w-3.5 h-3.5 text-accent" /> Capture an Idea
        </h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCapture(); }}
          placeholder="What&apos;s the idea? (Ctrl+Enter to save)"
          rows={3}
          className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as IdeaDomain)}
            className="bg-bg-tertiary border border-bg-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
          >
            {DOMAINS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <button
            onClick={handleCapture}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-40 hover:bg-accent/90 transition-colors"
          >
            <RiAddLine className="w-3.5 h-3.5" /> Save Idea
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ideas…"
          className="flex-1 min-w-[160px] bg-bg-secondary border border-bg-border rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as IdeaStatus | "all")}
          className="bg-bg-secondary border border-bg-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value as IdeaDomain | "all")}
          className="bg-bg-secondary border border-bg-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="all">All Domains</option>
          {DOMAINS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-xs text-text-muted text-center py-8">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-8">
          {ideas.filter((i) => i.status !== "discarded").length === 0
            ? "No ideas yet. Capture your first one above."
            : "No ideas match the current filters."}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((idea) => (
            <div key={idea.id} className="card py-3 px-4 flex items-start gap-3 group">
              <RiLightbulbLine className={`w-4 h-4 mt-0.5 shrink-0 ${domainColor(idea.domain)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary">{idea.text}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[10px] font-medium uppercase tracking-wide ${domainColor(idea.domain)}`}>
                    {domainLabel(idea.domain)}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {new Date(idea.created_at).toLocaleDateString()}
                  </span>
                  {idea.status !== "raw" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-muted capitalize">
                      {idea.status}
                    </span>
                  )}
                  {idea.tags.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                      {t}
                    </span>
                  ))}
                </div>

                {promotingId === idea.id && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      autoFocus
                      value={promoteName}
                      onChange={(e) => setPromoteName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePromote(idea);
                        if (e.key === "Escape") setPromotingId(null);
                      }}
                      placeholder="Project name…"
                      className="flex-1 bg-bg-tertiary border border-accent rounded px-2 py-1 text-xs text-text-primary focus:outline-none"
                    />
                    <button
                      onClick={() => handlePromote(idea)}
                      className="px-2 py-1 text-xs rounded bg-accent text-white hover:bg-accent/90"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setPromotingId(null)}
                      className="px-2 py-1 text-xs rounded bg-bg-tertiary text-text-muted hover:text-text-primary"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {idea.status === "raw" && (
                  <button
                    title="Mark as developing"
                    onClick={() => updateIdea(idea.id, { status: "developing" })}
                    className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-success transition-colors"
                  >
                    <RiCheckLine className="w-3.5 h-3.5" />
                  </button>
                )}
                {idea.status !== "promoted" && (
                  <button
                    title="Promote to project"
                    onClick={() => { setPromotingId(idea.id); setPromoteName(idea.text.slice(0, 40)); }}
                    className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent transition-colors"
                  >
                    <RiArrowUpLine className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  title={idea.status === "parked" ? "Unpark idea" : "Park idea"}
                  onClick={() => updateIdea(idea.id, { status: idea.status === "parked" ? "raw" : "parked" })}
                  className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-warning transition-colors"
                >
                  <RiArchiveLine className="w-3.5 h-3.5" />
                </button>
                <button
                  title="Discard"
                  onClick={() => updateIdea(idea.id, { status: "discarded" })}
                  className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-danger transition-colors"
                >
                  <RiDeleteBinLine className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

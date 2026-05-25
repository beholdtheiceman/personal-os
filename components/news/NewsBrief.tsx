"use client";
import { RiNewspaperLine, RiArrowDownSLine, RiExternalLinkLine } from "react-icons/ri";
import type { NewsBrief } from "@/types";

interface NewsBriefProps {
  brief: NewsBrief | null;
  loading: boolean;
  onRegenerate?: () => void;
}

export default function NewsBriefCard({ brief, loading, onRegenerate }: NewsBriefProps) {
  if (loading) {
    return (
      <div className="card mb-4">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <RiNewspaperLine className="w-3.5 h-3.5" />
          <span>Generating today&apos;s brief…</span>
        </div>
      </div>
    );
  }

  if (!brief) return null;

  return (
    <details className="card mb-4 group">
      <summary className="flex items-center justify-between cursor-pointer list-none select-none">
        <span className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wide">
          <RiNewspaperLine className="w-3.5 h-3.5" /> Today&apos;s Brief
        </span>
        <div className="flex items-center gap-2">
          {onRegenerate && (
            <button
              onClick={(e) => { e.preventDefault(); onRegenerate(); }}
              className="text-[10px] text-text-secondary hover:text-accent"
            >
              Regenerate
            </button>
          )}
          <RiArrowDownSLine className="w-4 h-4 text-text-secondary transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <p className="mt-3 text-sm text-text-primary leading-relaxed">
        {brief.summary}
      </p>

      {brief.sources.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
          {brief.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline flex items-start gap-1.5"
              >
                <RiExternalLinkLine className="w-3 h-3 mt-0.5 shrink-0" />
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

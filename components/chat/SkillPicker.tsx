"use client";
import type { Skill } from "@/lib/skills";

interface SkillPickerProps {
  open: boolean;
  skills: Skill[];
  highlightedIndex: number;
  onSelect: (skill: Skill) => void;
  onClose: () => void;
}

export default function SkillPicker({
  open, skills, highlightedIndex, onSelect, onClose,
}: SkillPickerProps) {
  if (!open || skills.length === 0) return null;

  return (
    <div
      className="absolute bottom-full mb-2 left-0 right-0 z-50 rounded-xl overflow-hidden shadow-2xl"
      style={{
        background: "rgba(18, 6, 16, 0.96)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(20px)",
      }}
      onMouseLeave={onClose}
    >
      <div
        className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        Skills · ↑↓ navigate · Enter to activate
      </div>
      <ul>
        {skills.map((skill, i) => (
          <li key={skill.id}>
            <button
              className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors"
              style={{
                background: i === highlightedIndex ? "rgba(255,255,255,0.08)" : "transparent",
              }}
              // onMouseDown prevents textarea losing focus before click registers
              onMouseDown={(e) => { e.preventDefault(); onSelect(skill); }}
            >
              <span className="text-xl shrink-0 mt-0.5">{skill.icon}</span>
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-white leading-snug">
                  /{skill.command}
                  <span className="ml-2 font-normal text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {skill.label}
                  </span>
                </span>
                <span className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {skill.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

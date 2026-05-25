"use client";
import type { Skill } from "@/lib/skills";

interface ActiveSkillBadgeProps {
  skill: Skill;
  onDismiss: () => void;
}

export default function ActiveSkillBadge({ skill, onDismiss }: ActiveSkillBadgeProps) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <span
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{
          background: "rgba(139,92,246,0.15)",
          border: "1px solid rgba(139,92,246,0.30)",
          color: "rgba(196,170,255,0.95)",
        }}
      >
        <span>{skill.icon}</span>
        <span>{skill.label} active</span>
        <button
          onClick={onDismiss}
          className="ml-1 hover:text-white transition-colors"
          aria-label="Exit skill mode"
          title="Exit skill mode"
        >
          ×
        </button>
      </span>
      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>
        Enhanced context applied · /end to exit
      </span>
    </div>
  );
}

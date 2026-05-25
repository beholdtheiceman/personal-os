import { useState } from "react";
import { type Skill, filterSkills } from "@/lib/skills";

export function useSkills(baseSystemPrompt: string) {
  const [activeSkill, setActiveSkill]           = useState<Skill | null>(null);
  const [pickerOpen, setPickerOpen]             = useState(false);
  const [filterQuery, setFilterQuery]           = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredSkills = filterSkills(filterQuery);

  const effectiveSystemPrompt = activeSkill
    ? `${baseSystemPrompt}\n\n${activeSkill.systemPromptAddition}`
    : baseSystemPrompt;

  /** Call from textarea onChange to keep picker in sync */
  function onInputChange(value: string) {
    if (value === "/") {
      setPickerOpen(true);
      setFilterQuery("");
      setHighlightedIndex(0);
    } else if (value.startsWith("/") && !value.includes(" ")) {
      setPickerOpen(true);
      setFilterQuery(value.slice(1));
      setHighlightedIndex(0);
    } else {
      setPickerOpen(false);
      setFilterQuery("");
    }
  }

  /**
   * Call from textarea onKeyDown when the picker is open.
   * Returns the Skill to activate (caller handles it), "consumed" if key
   * was handled but no activation, or null if picker wasn't involved.
   */
  function onPickerKeyDown(e: React.KeyboardEvent): Skill | "consumed" | null {
    if (!pickerOpen) return null;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filteredSkills.length - 1));
      return "consumed";
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
      return "consumed";
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setPickerOpen(false);
      return "consumed";
    }
    if (e.key === "Enter" || e.key === "Tab") {
      const skill = filteredSkills[highlightedIndex];
      if (skill) {
        e.preventDefault();
        return skill; // caller activates
      }
    }
    return null;
  }

  /** Mark a skill as active and close the picker */
  function activateSkill(skill: Skill) {
    setActiveSkill(skill);
    setPickerOpen(false);
    setFilterQuery("");
  }

  function dismissSkill() { setActiveSkill(null); }
  function closePicker()  { setPickerOpen(false); }

  return {
    activeSkill,
    pickerOpen,
    filteredSkills,
    highlightedIndex,
    effectiveSystemPrompt,
    onInputChange,
    onPickerKeyDown,
    activateSkill,
    dismissSkill,
    closePicker,
  };
}

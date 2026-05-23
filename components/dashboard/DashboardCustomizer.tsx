"use client";
import { useState } from "react";
import { DASHBOARD_WIDGETS } from "@/hooks/useDashboardSettings";
import {
  RiCloseLine, RiEyeLine, RiEyeOffLine,
  RiArrowUpLine, RiArrowDownLine, RiLayoutLine,
} from "react-icons/ri";
import toast from "react-hot-toast";

interface Props {
  widgetOrder: string[];
  hiddenWidgets: Set<string>;
  onSave: (order: string[], hidden: Set<string>) => Promise<void>;
  onClose: () => void;
}

export default function DashboardCustomizer({ widgetOrder, hiddenWidgets, onSave, onClose }: Props) {
  const [order, setOrder] = useState<string[]>(widgetOrder);
  const [hidden, setHidden] = useState<Set<string>>(new Set(hiddenWidgets));
  const [saving, setSaving] = useState(false);

  const labelFor = (id: string) =>
    DASHBOARD_WIDGETS.find((w) => w.id === id)?.label ?? id;

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next);
  };

  const moveDown = (idx: number) => {
    if (idx === order.length - 1) return;
    const next = [...order];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setOrder(next);
  };

  const toggleHidden = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHidden(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(order, hidden);
      toast.success("Dashboard layout saved");
      onClose();
    } catch {
      toast.error("Failed to save layout");
    } finally {
      setSaving(false);
    }
  };

  const visibleCount = order.filter((id) => !hidden.has(id)).length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Slide-in panel */}
      <div className="fixed right-0 top-0 h-full w-80 max-w-[92vw] bg-bg-primary border-l border-bg-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border">
          <div className="flex items-center gap-2">
            <RiLayoutLine className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Customize Dashboard</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-muted transition-colors"
          >
            <RiCloseLine className="w-4 h-4" />
          </button>
        </div>

        {/* Subheader */}
        <div className="px-4 py-2 border-b border-bg-border bg-bg-secondary/50">
          <p className="text-xs text-text-muted">
            {visibleCount} of {order.length} widgets shown · use ↑↓ to reorder
          </p>
        </div>

        {/* Widget list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {order.map((id, idx) => {
            const isHidden = hidden.has(id);
            return (
              <div
                key={id}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                  isHidden
                    ? "opacity-40 border-bg-border bg-bg-tertiary/30"
                    : "border-bg-border hover:border-accent/30 bg-bg-secondary/50"
                }`}
              >
                {/* Visibility toggle */}
                <button
                  onClick={() => toggleHidden(id)}
                  title={isHidden ? "Show widget" : "Hide widget"}
                  className={`shrink-0 p-0.5 rounded transition-colors ${
                    isHidden ? "text-text-muted" : "text-accent hover:text-accent-text"
                  }`}
                >
                  {isHidden
                    ? <RiEyeOffLine className="w-4 h-4" />
                    : <RiEyeLine className="w-4 h-4" />}
                </button>

                {/* Label */}
                <span className="flex-1 text-sm text-text-primary truncate select-none">
                  {labelFor(id)}
                </span>

                {/* Reorder arrows */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-default transition-colors"
                  >
                    <RiArrowUpLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === order.length - 1}
                    className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-default transition-colors"
                  >
                    <RiArrowDownLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-bg-border space-y-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary w-full disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Layout"}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

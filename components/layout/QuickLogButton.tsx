"use client";
// Floating button visible on every page — opens the quick task logger
import { useState } from "react";
import { RiAddLine } from "react-icons/ri";
import QuickLogModal from "@/components/tasks/QuickLogModal";

export default function QuickLogButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Quick log (task or note)"
      >
        <RiAddLine className="w-6 h-6" />
      </button>

      {open && <QuickLogModal onClose={() => setOpen(false)} />}
    </>
  );
}

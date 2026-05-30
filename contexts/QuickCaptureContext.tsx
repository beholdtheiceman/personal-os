"use client";
import { createContext, useContext, useState, ReactNode } from "react";

interface Ctx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const QuickCaptureContext = createContext<Ctx | null>(null);

export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <QuickCaptureContext.Provider
      value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}
    >
      {children}
    </QuickCaptureContext.Provider>
  );
}

export function useQuickCapture() {
  const ctx = useContext(QuickCaptureContext);
  if (!ctx) throw new Error("useQuickCapture must be within QuickCaptureProvider");
  return ctx;
}

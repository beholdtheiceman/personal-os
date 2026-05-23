"use client";
import { useEffect, useState } from "react";

// True on touch / coarse-pointer devices (phones, tablets). Used to decide input
// behavior like "Enter inserts a newline instead of sending". Starts false so SSR
// matches the desktop default, then corrects on mount and stays reactive.
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setIsTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  return isTouch;
}

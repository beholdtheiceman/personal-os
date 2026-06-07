"use client";
import { useEffect } from "react";

// Subscribe a dashboard widget to the `os:refresh-widget` CustomEvent (dispatched
// by the voice/chat client-tool bus). When the event's `detail.widget` matches this
// widget's key, `fn` runs. Pass a stable `fn` (wrap in useCallback).
export function useWidgetRefresh(key: string, fn: () => void) {
  useEffect(() => {
    const h = (e: Event) => {
      if ((e as CustomEvent).detail?.widget === key) fn();
    };
    window.addEventListener("os:refresh-widget", h);
    return () => window.removeEventListener("os:refresh-widget", h);
  }, [key, fn]);
}

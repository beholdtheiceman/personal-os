"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

interface SOPState {
  sopId: string | null;
  sopTitle: string | null;
  stepIndex: number;
  totalSteps: number;
  activatedAt: string | null;
}

interface SOPContextType extends SOPState {
  activateSOP: (sopId: string, sopTitle: string, totalSteps: number) => void;
  deactivateSOP: () => void;
  advanceStep: () => void;
}

const SOPContext = createContext<SOPContextType | null>(null);

export function useSOP() {
  const ctx = useContext(SOPContext);
  if (!ctx) throw new Error("useSOP must be inside SOPProvider");
  return ctx;
}

const EMPTY: SOPState = { sopId: null, sopTitle: null, stepIndex: 0, totalSteps: 0, activatedAt: null };

export function SOPProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<SOPState>(EMPTY);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid, "settings", "active_sop"), (snap) => {
      if (!snap.exists() || !snap.data().sopId) { setState(EMPTY); return; }
      const d = snap.data();
      setState({
        sopId: d.sopId ?? null,
        sopTitle: d.sopTitle ?? null,
        stepIndex: d.stepIndex ?? 0,
        totalSteps: d.totalSteps ?? 0,
        activatedAt: d.activatedAt ?? null,
      });
    });
  }, [user]);

  const activateSOP = useCallback(async (sopId: string, sopTitle: string, totalSteps: number) => {
    if (!user) return;
    const activatedAt = new Date().toISOString();
    setState({ sopId, sopTitle, stepIndex: 0, totalSteps, activatedAt });
    await setDoc(doc(db, "users", user.uid, "settings", "active_sop"),
      { sopId, sopTitle, stepIndex: 0, totalSteps, activatedAt }, { merge: true });
  }, [user]);

  const deactivateSOP = useCallback(async () => {
    if (!user) return;
    setState(EMPTY);
    await setDoc(doc(db, "users", user.uid, "settings", "active_sop"),
      { sopId: null, sopTitle: null, stepIndex: 0, totalSteps: 0, activatedAt: null }, { merge: true });
  }, [user]);

  const advanceStep = useCallback(async () => {
    if (!user || !state.sopId) return;
    const next = Math.min(state.stepIndex + 1, state.totalSteps - 1);
    setState((s) => ({ ...s, stepIndex: next }));
    await setDoc(doc(db, "users", user.uid, "settings", "active_sop"),
      { stepIndex: next }, { merge: true });
  }, [user, state.sopId, state.stepIndex, state.totalSteps]);

  // CustomEvent bridge from client-actions.ts tool calls
  useEffect(() => {
    const onActivate = (e: Event) => {
      const { sopId, sopTitle, totalSteps } = (e as CustomEvent).detail ?? {};
      if (sopId) activateSOP(sopId, sopTitle ?? "SOP", totalSteps ?? 0);
    };
    const onDeactivate = () => deactivateSOP();
    const onAdvance = () => advanceStep();
    window.addEventListener("os:activate-sop", onActivate);
    window.addEventListener("os:deactivate-sop", onDeactivate);
    window.addEventListener("os:advance-sop-step", onAdvance);
    return () => {
      window.removeEventListener("os:activate-sop", onActivate);
      window.removeEventListener("os:deactivate-sop", onDeactivate);
      window.removeEventListener("os:advance-sop-step", onAdvance);
    };
  }, [activateSOP, deactivateSOP, advanceStep]);

  return (
    <SOPContext.Provider value={{ ...state, activateSOP, deactivateSOP, advanceStep }}>
      {children}
    </SOPContext.Provider>
  );
}

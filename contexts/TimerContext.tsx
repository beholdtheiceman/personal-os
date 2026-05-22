"use client";
import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";
import type { TimeCategory } from "@/types";

export type TimerStatus = "idle" | "running" | "paused" | "break";

interface TimerState {
  status: TimerStatus;
  taskName: string;
  taskId: string | null;
  category: TimeCategory;
  durationMin: number;
  secondsRemaining: number;
  breakDurationMin: number;
  sessionsToday: number;
}

interface TimerContextType extends TimerState {
  start: (taskName: string, durationMin: number, options?: { taskId?: string; category?: TimeCategory }) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const TimerContext = createContext<TimerContextType | null>(null);

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used inside TimerProvider");
  return ctx;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<TimerState>({
    status: "idle",
    taskName: "",
    taskId: null,
    category: "work",
    durationMin: 25,
    secondsRemaining: 25 * 60,
    breakDurationMin: 5,
    sessionsToday: 0,
  });

  // Keep a ref to current state for use inside interval callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track when the focus session started (ISO string) for the time entry
  const sessionStartRef = useRef<string>("");

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const writeTimeEntry = useCallback(
    async (taskName: string, taskId: string | null, category: TimeCategory, durationMin: number, startTime: string) => {
      if (!user) return;
      const now = new Date().toISOString();
      const today = format(new Date(), "yyyy-MM-dd");
      await addDoc(collection(db, "users", user.uid, "time_entries"), {
        date: today,
        start_time: startTime,
        end_time: now,
        duration_min: durationMin,
        description: taskName,
        task_id: taskId ?? null,
        project_id: null,
        category,
        source: "timer",
        created_at: now,
      });
    },
    [user]
  );

  const handleSessionComplete = useCallback(async () => {
    const s = stateRef.current;
    clearTimer();
    await writeTimeEntry(s.taskName, s.taskId, s.category, s.durationMin, sessionStartRef.current);
    toast.success(`Focus session complete — ${s.durationMin} min logged to "${s.taskName}"`, { duration: 5000 });
    // Start break timer
    setState((prev) => ({
      ...prev,
      status: "break",
      secondsRemaining: prev.breakDurationMin * 60,
      sessionsToday: prev.sessionsToday + 1,
    }));
  }, [writeTimeEntry]);

  const handleBreakComplete = useCallback(() => {
    clearTimer();
    toast("Break over — ready for your next session!", { icon: "🍅" });
    setState((prev) => ({ ...prev, status: "idle", secondsRemaining: prev.durationMin * 60 }));
  }, []);

  // Tick interval
  useEffect(() => {
    if (state.status === "running" || state.status === "break") {
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.secondsRemaining <= 1) {
            // Will complete — fire async work outside setState
            return { ...prev, secondsRemaining: 0 };
          }
          return { ...prev, secondsRemaining: prev.secondsRemaining - 1 };
        });
      }, 1000);
    } else {
      clearTimer();
    }
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // Watch for completion
  useEffect(() => {
    if (state.secondsRemaining === 0 && state.status === "running") {
      handleSessionComplete();
    }
    if (state.secondsRemaining === 0 && state.status === "break") {
      handleBreakComplete();
    }
  }, [state.secondsRemaining, state.status, handleSessionComplete, handleBreakComplete]);

  const start = useCallback(
    (taskName: string, durationMin: number, options?: { taskId?: string; category?: TimeCategory }) => {
      clearTimer();
      sessionStartRef.current = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        status: "running",
        taskName,
        taskId: options?.taskId ?? null,
        category: options?.category ?? "work",
        durationMin,
        secondsRemaining: durationMin * 60,
      }));
    },
    []
  );

  const pause = useCallback(() => {
    setState((prev) => prev.status === "running" ? { ...prev, status: "paused" } : prev);
  }, []);

  const resume = useCallback(() => {
    setState((prev) => prev.status === "paused" ? { ...prev, status: "running" } : prev);
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setState((prev) => ({ ...prev, status: "idle", secondsRemaining: prev.durationMin * 60 }));
  }, []);

  return (
    <TimerContext.Provider value={{ ...state, start, pause, resume, stop }}>
      {children}
    </TimerContext.Provider>
  );
}

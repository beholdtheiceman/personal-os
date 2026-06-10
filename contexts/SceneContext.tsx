"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getScene, Scene } from "@/lib/scenes";

interface SceneState {
  activeScene: Scene | null;
  activatedAt: string | null;
}

interface SceneContextType extends SceneState {
  activate: (sceneId: string) => void;
  deactivate: () => void;
}

const SceneContext = createContext<SceneContextType | null>(null);

export function useScene() {
  const ctx = useContext(SceneContext);
  if (!ctx) throw new Error("useScene must be inside SceneProvider");
  return ctx;
}

export function SceneProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<SceneState>({ activeScene: null, activatedAt: null });

  // Load persisted active scene from Firestore
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid, "settings", "active_scene");
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setState({ activeScene: null, activatedAt: null });
        return;
      }
      const data = snap.data();
      const scene = data.sceneId ? getScene(data.sceneId) : null;
      setState({ activeScene: scene ?? null, activatedAt: data.activatedAt ?? null });
    });
  }, [user]);

  const activate = useCallback(
    async (sceneId: string) => {
      const scene = getScene(sceneId);
      if (!scene || !user) return;
      const activatedAt = new Date().toISOString();
      setState({ activeScene: scene, activatedAt });
      await setDoc(
        doc(db, "users", user.uid, "settings", "active_scene"),
        { sceneId, activatedAt },
        { merge: true },
      );
    },
    [user],
  );

  const deactivate = useCallback(async () => {
    if (!user) return;
    setState({ activeScene: null, activatedAt: null });
    await setDoc(
      doc(db, "users", user.uid, "settings", "active_scene"),
      { sceneId: null, activatedAt: null },
      { merge: true },
    );
  }, [user]);

  // Listen for CustomEvents dispatched from client-actions.ts (tool calls)
  useEffect(() => {
    const onActivate = (e: Event) => {
      const { sceneId } = (e as CustomEvent).detail ?? {};
      if (sceneId) activate(sceneId);
    };
    const onDeactivate = () => deactivate();
    window.addEventListener("os:activate-scene", onActivate);
    window.addEventListener("os:deactivate-scene", onDeactivate);
    return () => {
      window.removeEventListener("os:activate-scene", onActivate);
      window.removeEventListener("os:deactivate-scene", onDeactivate);
    };
  }, [activate, deactivate]);

  return (
    <SceneContext.Provider value={{ ...state, activate, deactivate }}>
      {children}
    </SceneContext.Provider>
  );
}

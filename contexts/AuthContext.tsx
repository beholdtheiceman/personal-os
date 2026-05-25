"use client";
// Provides the currently signed-in Firebase user to the whole app
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOutUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Create/touch the users/{uid} parent document so cron jobs that
        // iterate db.collection("users") can find this user. Subcollection
        // writes alone do NOT create the parent doc in Firestore.
        setDoc(doc(db, "users", u.uid), {
          uid: u.uid,
          email: u.email ?? null,
          displayName: u.displayName ?? null,
          last_seen: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
        setDoc(doc(db, `users/${u.uid}/settings/timezone`), {
          current_timezone: tz,
          updated_at: new Date().toISOString(),
        }, { merge: true }).catch(() => {});
      }
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

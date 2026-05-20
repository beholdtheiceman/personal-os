"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export interface PlaidRecurring {
  stream_id: string;
  institution: string;
  merchant_name: string;
  description: string;
  amount: number;
  currency: string;
  frequency: string;
  last_date: string;
  first_date: string;
  is_active: boolean;
  category: string;
}

export interface PlaidItem {
  item_id: string;
  institution_name: string;
  connected_at: string;
}

export interface PlaidSettings {
  last_synced: string | null;
  item_count: number;
}

export function usePlaid() {
  const { user } = useAuth();
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [recurring, setRecurring] = useState<PlaidRecurring[]>([]);
  const [settings, setSettings] = useState<PlaidSettings>({ last_synced: null, item_count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubItems = onSnapshot(
      collection(db, `users/${user.uid}/plaid_items`),
      (snap) => {
        setItems(snap.docs.map((d) => d.data() as PlaidItem));
        setLoading(false);
      }
    );

    const unsubRecurring = onSnapshot(
      collection(db, `users/${user.uid}/plaid_recurring`),
      (snap) => setRecurring(snap.docs.map((d) => d.data() as PlaidRecurring))
    );

    const unsubSettings = onSnapshot(
      doc(db, `users/${user.uid}/settings/plaid`),
      (snap) => {
        if (snap.exists()) setSettings(snap.data() as PlaidSettings);
      }
    );

    return () => { unsubItems(); unsubRecurring(); unsubSettings(); };
  }, [user]);

  const monthlyTotal = recurring
    .filter((r) => r.is_active)
    .reduce((sum, r) => {
      // Normalize all frequencies to monthly cost
      switch (r.frequency) {
        case "WEEKLY":       return sum + r.amount * 4.33;
        case "BIWEEKLY":     return sum + r.amount * 2.17;
        case "SEMI_MONTHLY": return sum + r.amount * 2;
        case "MONTHLY":      return sum + r.amount;
        case "ANNUALLY":     return sum + r.amount / 12;
        default:             return sum + r.amount;
      }
    }, 0);

  return { items, recurring, settings, loading, monthlyTotal };
}

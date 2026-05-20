"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Subscription, BillingCycle } from "@/types";

export function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case "weekly":    return amount * 4.33;
    case "monthly":   return amount;
    case "quarterly": return amount / 3;
    case "yearly":    return amount / 12;
  }
}

export function useSubscriptions() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "subscriptions"),
      orderBy("next_billing_date", "asc")
    );
    return onSnapshot(q, (snap) => {
      setSubscriptions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subscription)));
      setLoading(false);
    });
  }, [user]);

  const active = subscriptions.filter((s) => s.status === "active");

  const monthlyTotal = active.reduce(
    (sum, s) => sum + monthlyEquivalent(s.amount, s.billing_cycle), 0
  );

  const yearlyTotal = monthlyTotal * 12;

  // Subscriptions due in the next 7 days
  const today = new Date();
  const in7 = new Date(); in7.setDate(today.getDate() + 7);
  const dueSoon = active.filter((s) => {
    const d = new Date(s.next_billing_date + "T12:00:00");
    return d >= today && d <= in7;
  });

  return { subscriptions, active, loading, monthlyTotal, yearlyTotal, dueSoon };
}

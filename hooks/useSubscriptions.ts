"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { advancedBillingDate } from "@/lib/recurrence";
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

      // Silently advance any active subscription with a past next_billing_date
      const today = format(new Date(), 'yyyy-MM-dd');
      snap.docs.forEach((d) => {
        const sub = d.data() as Omit<Subscription, 'id'>;
        if (sub.status === 'active' && sub.next_billing_date < today) {
          const advanced = advancedBillingDate(sub.billing_cycle, sub.next_billing_date);
          updateDoc(doc(db, 'users', user.uid, 'subscriptions', d.id), {
            next_billing_date: advanced,
          });
        }
      });
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

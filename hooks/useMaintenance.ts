"use client";
import { useState, useEffect } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { MaintenanceItem, MaintenanceLog } from "@/types";

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isDueSoon(item: MaintenanceItem, withinDays = 30): boolean {
  if (!item.next_due) return false;
  const cutoff = addDays(new Date().toISOString().slice(0, 10), withinDays);
  return item.next_due <= cutoff;
}

export function isOverdue(item: MaintenanceItem): boolean {
  if (!item.next_due) return false;
  return item.next_due < new Date().toISOString().slice(0, 10);
}

export function useMaintenance() {
  const { user } = useAuth();
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub1 = onSnapshot(
      query(collection(db, `users/${user.uid}/maintenance`), orderBy("created_at", "desc")),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MaintenanceItem)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    const unsub2 = onSnapshot(
      query(collection(db, `users/${user.uid}/maintenance_logs`), orderBy("date", "desc")),
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MaintenanceLog))),
    );
    return () => { unsub1(); unsub2(); };
  }, [user]);

  async function addItem(item: Omit<MaintenanceItem, "id" | "created_at" | "updated_at">) {
    if (!user) return;
    const now = new Date().toISOString();
    await addDoc(collection(db, `users/${user.uid}/maintenance`), {
      ...item,
      status: "active",
      created_at: now,
      updated_at: now,
    });
  }

  async function updateItem(id: string, patch: Partial<Omit<MaintenanceItem, "id" | "created_at">>) {
    if (!user) return;
    await updateDoc(doc(db, `users/${user.uid}/maintenance/${id}`), {
      ...patch,
      updated_at: new Date().toISOString(),
    });
  }

  async function deleteItem(id: string) {
    if (!user) return;
    await deleteDoc(doc(db, `users/${user.uid}/maintenance/${id}`));
  }

  async function logService(
    itemId: string,
    date: string,
    opts: { notes?: string; cost?: number; contractor?: string } = {},
  ) {
    if (!user) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    await addDoc(collection(db, `users/${user.uid}/maintenance_logs`), {
      item_id: itemId,
      item_name: item.name,
      date,
      notes: opts.notes ?? "",
      cost: opts.cost ?? null,
      contractor: opts.contractor ?? "",
      created_at: new Date().toISOString(),
    });
    const patch: Partial<MaintenanceItem> = { last_service: date };
    if (item.interval_days) {
      patch.next_due = addDays(date, item.interval_days);
    }
    await updateItem(itemId, patch);
  }

  const active = items.filter((i) => i.status === "active");
  const dueSoon = active.filter((i) => isDueSoon(i) && !isOverdue(i));
  const overdue = active.filter((i) => isOverdue(i));

  return { items, logs, loading, active, dueSoon, overdue, addItem, updateItem, deleteItem, logService };
}

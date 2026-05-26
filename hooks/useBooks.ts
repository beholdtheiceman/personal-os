"use client";
import { useEffect, useState, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Book, BookStatus } from "@/types";

export function useBooks() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/books`),
      orderBy("created_at", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Book)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const addBook = useCallback(
    async (data: Omit<Book, "id" | "created_at" | "updated_at" | "highlights">) => {
      if (!user) return;
      const now = new Date().toISOString();
      const extra: Partial<Book> = {};
      if (data.status === "reading" && !data.start_date) {
        extra.start_date = new Date().toLocaleDateString("en-CA");
      }
      await addDoc(collection(db, `users/${user.uid}/books`), {
        ...data,
        ...extra,
        highlights: [],
        created_at: now,
        updated_at: now,
      });
    },
    [user]
  );

  const updateBook = useCallback(
    async (id: string, data: Partial<Book>) => {
      if (!user) return;
      const extra: Partial<Book> = {};
      const book = books.find((b) => b.id === id);
      if (book && data.status === "reading" && book.status !== "reading" && !book.start_date) {
        extra.start_date = new Date().toLocaleDateString("en-CA");
      }
      if (book && data.status === "finished" && !book.finish_date) {
        extra.finish_date = new Date().toLocaleDateString("en-CA");
      }
      const payload = Object.fromEntries(
        Object.entries({ ...data, ...extra, updated_at: new Date().toISOString() })
          .filter(([, v]) => v !== undefined)
      );
      await updateDoc(doc(db, `users/${user.uid}/books/${id}`), payload);
    },
    [user, books]
  );

  const deleteBook = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteDoc(doc(db, `users/${user.uid}/books/${id}`));
    },
    [user]
  );

  const addHighlight = useCallback(
    async (id: string, highlight: string) => {
      if (!user) return;
      const book = books.find((b) => b.id === id);
      if (!book) return;
      await updateDoc(doc(db, `users/${user.uid}/books/${id}`), {
        highlights: [...book.highlights, highlight],
        updated_at: new Date().toISOString(),
      });
    },
    [user, books]
  );

  const removeHighlight = useCallback(
    async (id: string, index: number) => {
      if (!user) return;
      const book = books.find((b) => b.id === id);
      if (!book) return;
      const updated = book.highlights.filter((_, i) => i !== index);
      await updateDoc(doc(db, `users/${user.uid}/books/${id}`), {
        highlights: updated,
        updated_at: new Date().toISOString(),
      });
    },
    [user, books]
  );

  const reorderBooks = useCallback(
    async (orderedIds: string[]) => {
      if (!user) return;
      const batch = writeBatch(db);
      orderedIds.forEach((id, index) => {
        batch.update(doc(db, `users/${user.uid}/books/${id}`), { order: index });
      });
      await batch.commit();
    },
    [user]
  );

  const byStatus = (status: BookStatus) => {
    const list = books.filter((b) => b.status === status);
    if (status === "want_to_read") {
      return list.slice().sort((a, b) => {
        const ao = a.order ?? Infinity;
        const bo = b.order ?? Infinity;
        return ao !== bo ? ao - bo : (a.created_at < b.created_at ? -1 : 1);
      });
    }
    return list;
  };

  return {
    books,
    loading,
    reading:      byStatus("reading"),
    wantToRead:   byStatus("want_to_read"),
    finished:     byStatus("finished"),
    abandoned:    byStatus("abandoned"),
    addBook,
    updateBook,
    deleteBook,
    addHighlight,
    removeHighlight,
    reorderBooks,
  };
}

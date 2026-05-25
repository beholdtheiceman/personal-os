"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, updateDoc, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { RiNewspaperLine, RiRefreshLine, RiLoader4Line } from "react-icons/ri";
import NewsCard from "@/components/news/NewsCard";
import NewsBriefCard from "@/components/news/NewsBrief";
import type { NewsItem, NewsBrief } from "@/types";

const ALL_TAB = "All";

export default function NewsPage() {
  const { user } = useAuth();
  const [items, setItems]           = useState<NewsItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab]   = useState(ALL_TAB);
  const [brief, setBrief]           = useState<NewsBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);

  const fetchFeed = useCallback(async (status = "unread") => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(`/api/news/feed?status=${status}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items ?? []);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchFeed().finally(() => setLoading(false));
  }, [fetchFeed]);

  // Fetch daily brief
  useEffect(() => {
    if (!user) return;
    setBriefLoading(true);
    user.getIdToken().then((token) =>
      fetch("/api/news/brief", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setBrief(d.brief ?? null))
        .catch(() => setBrief(null))
        .finally(() => setBriefLoading(false))
    );
  }, [user]);

  // Derive tabs from tags across all loaded items
  const allTags = Array.from(
    new Set(items.flatMap((i) => i.tags))
  ).sort();
  const tabs = [ALL_TAB, ...allTags];

  const visible = activeTab === ALL_TAB
    ? items
    : items.filter((i) => i.tags.includes(activeTab));

  // ── Actions ────────────────────────────────────────────────────────────────

  async function updateStatus(id: string, status: NewsItem["status"]) {
    if (!user) return;
    const prev_status = items.find((i) => i.id === id)?.status;
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    try {
      await updateDoc(doc(db, `users/${user.uid}/news_items/${id}`), {
        status,
        ...(status === "saved" ? { saved_at: new Date().toISOString() } : {}),
      });
    } catch (err) {
      console.error("[NewsPage] updateStatus failed:", err);
      if (prev_status) {
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: prev_status } : i));
      }
    }
  }

  async function handleRead(id: string) {
    await updateStatus(id, "read");
  }

  async function handleDismiss(id: string) {
    await updateStatus(id, "dismissed");
  }

  async function handleSave(id: string) {
    if (!user) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const now = new Date().toISOString();
    try {
      await addDoc(collection(db, `users/${user.uid}/books`), {
        title:      item.title,
        author:     item.feed_name,
        status:     "want_to_read",
        highlights: [],
        url:        item.url,
        tags:       item.tags,
        created_at: now,
        updated_at: now,
      });
    } catch (err) {
      console.error("[NewsPage] save to reading list failed:", err);
    }

    await updateStatus(id, "saved");
  }

  async function handleStar(id: string, starred: boolean) {
    if (!user) return;
    const prev = items.find((i) => i.id === id)?.starred;
    setItems((prev_items) => prev_items.map((i) => i.id === id ? { ...i, starred } : i));
    try {
      await updateDoc(doc(db, `users/${user.uid}/news_items/${id}`), { starred });
    } catch (err) {
      console.error("[NewsPage] handleStar failed:", err);
      setItems((prev_items) => prev_items.map((i) => i.id === id ? { ...i, starred: prev } : i));
    }
  }

  async function handleRegenerate() {
    if (!user) return;
    setBriefLoading(true);
    try {
      const token = await user.getIdToken();
      // Delete today's cached brief so the route regenerates it
      const today = new Date().toISOString().slice(0, 10);
      await fetch(`/api/news/brief?date=${today}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const res = await fetch("/api/news/brief", { headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      setBrief(d.brief ?? null);
    } catch {
      // ignore
    } finally {
      setBriefLoading(false);
    }
  }

  async function handleRefresh() {
    if (!user || refreshing) return;
    setRefreshing(true);
    try {
      const token = await user.getIdToken();
      await fetch("/api/news/refresh", {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchFeed();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <RiNewspaperLine className="w-5 h-5 text-accent" /> News
        </h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5"
        >
          {refreshing
            ? <RiLoader4Line className="w-3.5 h-3.5 animate-spin" />
            : <RiRefreshLine className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {/* Daily brief */}
      <NewsBriefCard brief={brief} loading={briefLoading} onRegenerate={handleRegenerate} />

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap mb-5">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeTab === tab
                ? "bg-accent text-white border-accent"
                : "border-white/10 text-text-secondary hover:border-accent hover:text-text-primary"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RiLoader4Line className="w-6 h-6 animate-spin text-text-secondary" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <RiNewspaperLine className="w-8 h-8 text-text-secondary mx-auto mb-3" />
          <p className="text-sm text-text-secondary">
            {items.length === 0
              ? "No stories yet — hit Refresh to fetch your feeds."
              : `No stories in "${activeTab}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible
            .filter((i) => i.status !== "dismissed" && i.status !== "read")
            .map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                onRead={handleRead}
                onSave={handleSave}
                onDismiss={handleDismiss}
                onStar={handleStar}
              />
            ))}
        </div>
      )}
    </div>
  );
}

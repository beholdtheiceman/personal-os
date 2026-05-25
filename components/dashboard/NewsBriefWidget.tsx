"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RiNewspaperLine, RiExternalLinkLine } from "react-icons/ri";
import type { NewsBrief, NewsItem } from "@/types";

export default function NewsBriefWidget() {
  const { user } = useAuth();
  const [brief, setBrief]             = useState<NewsBrief | null>(null);
  const [fallback, setFallback]       = useState<NewsItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  // Fetch the daily brief
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((token) =>
      fetch("/api/news/brief", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => {
          if (d.brief) { setBrief(d.brief); setLoading(false); }
          else         { setUseFallback(true); setLoading(false); }
        })
        .catch(() => { setUseFallback(true); setLoading(false); })
    );
  }, [user]);

  // Fallback: live snapshot of top 3 unread articles when no brief exists
  useEffect(() => {
    if (!user || !useFallback) return;
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const q = query(
      collection(db, `users/${user.uid}/news_items`),
      where("status", "==", "unread"),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => d.data() as NewsItem)
        .filter((i) => i.fetched_at >= sixHoursAgo)
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, 3);
      setFallback(items);
    });
  }, [user, useFallback]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
          <RiNewspaperLine className="w-3.5 h-3.5" /> Top Stories
        </h2>
        <Link href="/news" className="text-xs text-accent hover:underline">View all</Link>
      </div>

      {loading ? (
        <p className="text-xs text-text-secondary">Loading…</p>
      ) : brief ? (
        <>
          <p className="text-xs text-text-primary leading-relaxed line-clamp-3 mb-3">
            {brief.summary}
          </p>
          <ul className="space-y-2">
            {brief.sources.slice(0, 3).map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-2 group">
                  <RiExternalLinkLine className="w-3 h-3 mt-0.5 text-text-secondary shrink-0 group-hover:text-accent" />
                  <span className="text-xs text-text-primary group-hover:text-accent leading-snug line-clamp-2">
                    {s.title}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : fallback.length === 0 ? (
        <p className="text-xs text-text-secondary">
          No recent stories.{" "}
          <Link href="/news" className="text-accent hover:underline">Refresh feed</Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {fallback.map((item) => (
            <li key={item.id}>
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-2 group">
                <RiExternalLinkLine className="w-3 h-3 mt-0.5 text-text-secondary shrink-0 group-hover:text-accent" />
                <span className="text-xs text-text-primary group-hover:text-accent leading-snug line-clamp-2">
                  {item.title}
                </span>
              </a>
              <p className="text-[10px] text-text-secondary ml-5 mt-0.5">
                {item.feed_name} · {item.relevance_score}/10
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

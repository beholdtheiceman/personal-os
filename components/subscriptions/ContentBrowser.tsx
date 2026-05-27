"use client";
import { useState, useEffect } from "react";
import { RiCloseLine, RiMovieLine, RiTvLine, RiStarLine, RiHeartLine, RiHeartFill } from "react-icons/ri";
import { useWatchlist } from "@/hooks/useWatchlist";
import { monthlyEquivalent } from "@/hooks/useSubscriptions";
import type { Subscription } from "@/types";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

interface TmdbItem {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  media_type: "movie" | "tv";
}

interface ContentBrowserProps {
  subscription: Subscription;
  onClose: () => void;
}

interface Verdict {
  label: string;
  color: string;
  tip: string;
}

function getVerdict(watchlistCount: number, monthlyCost: number): Verdict {
  if (watchlistCount === 0) {
    return { label: "No watchlist items yet", color: "text-text-muted", tip: "Mark titles you want to watch to see your value score." };
  }
  const perTitle = monthlyCost / watchlistCount;
  if (perTitle < 3)  return { label: "Great value", color: "text-success", tip: `$${perTitle.toFixed(2)} per title you care about` };
  if (perTitle < 8)  return { label: "Decent value", color: "text-warning", tip: `$${perTitle.toFixed(2)} per title you care about` };
  return { label: "Consider cancelling", color: "text-danger", tip: `$${perTitle.toFixed(2)} per title you care about — not much on your list` };
}

function getTitle(item: TmdbItem): string {
  return item.media_type === "movie" ? (item.title ?? "") : (item.name ?? "");
}

function getYear(item: TmdbItem): string {
  const date = item.media_type === "movie" ? item.release_date : item.first_air_date;
  return date?.slice(0, 4) ?? "";
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }}>
      <div className="aspect-[2/3] bg-white/10" />
      <div className="p-2 space-y-1.5">
        <div className="h-2.5 bg-white/10 rounded w-3/4" />
        <div className="h-2 bg-white/10 rounded w-1/2" />
      </div>
    </div>
  );
}

interface ContentCardProps {
  item: TmdbItem;
  subscriptionId: string;
}

function ContentCard({ item, subscriptionId }: ContentCardProps) {
  const { isOnWatchlist, toggleWatchlistItem } = useWatchlist();
  const [hovered, setHovered] = useState(false);
  const [toggling, setToggling] = useState(false);

  const onList = isOnWatchlist(item.id, subscriptionId);
  const title = getTitle(item);
  const year = getYear(item);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const posterUrl = item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    await toggleWatchlistItem({
      titleId: item.id,
      subscriptionId,
      title,
      poster: posterUrl,
      media_type: item.media_type,
      added_at: new Date().toISOString(),
    });
    setToggling(false);
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-default select-none"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Poster */}
      <div className="aspect-[2/3] relative bg-white/5">
        {posterUrl ? (
          <img src={posterUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {item.media_type === "movie"
              ? <RiMovieLine className="w-8 h-8 text-text-muted/40" />
              : <RiTvLine className="w-8 h-8 text-text-muted/40" />}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide ${
            item.media_type === "movie"
              ? "bg-accent/80 text-white"
              : "bg-blue-500/80 text-white"
          }`}>
            {item.media_type === "movie" ? "Film" : "TV"}
          </span>
        </div>

        {rating && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/60 rounded-full px-1.5 py-0.5">
            <RiStarLine className="w-2.5 h-2.5 text-yellow-400" />
            <span className="text-[9px] text-white font-medium">{rating}</span>
          </div>
        )}

        {/* Hover overlay */}
        {hovered && (
          <div className="absolute inset-0 flex flex-col justify-end p-2.5 gap-2"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 60%, rgba(0,0,0,0.4) 100%)" }}>
            {item.overview && (
              <p className="text-[10px] text-white/80 leading-relaxed line-clamp-4">{item.overview}</p>
            )}
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                onList
                  ? "bg-accent/30 text-accent hover:bg-accent/20"
                  : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              {onList
                ? <><RiHeartFill className="w-3 h-3" /> Interested</>
                : <><RiHeartLine className="w-3 h-3" /> Interested</>}
            </button>
          </div>
        )}

        {/* Persistent heart if on watchlist and not hovered */}
        {onList && !hovered && (
          <div className="absolute bottom-1.5 right-1.5">
            <RiHeartFill className="w-3.5 h-3.5 text-accent drop-shadow-sm" />
          </div>
        )}
      </div>

      {/* Title / year */}
      <div className="px-2 py-2">
        <p className="text-[11px] font-medium text-text-primary truncate leading-tight">{title}</p>
        {year && <p className="text-[10px] text-text-muted mt-0.5">{year}</p>}
      </div>
    </div>
  );
}

export default function ContentBrowser({ subscription, onClose }: ContentBrowserProps) {
  const [results, setResults] = useState<TmdbItem[]>([]);
  const [totalMovies, setTotalMovies] = useState(0);
  const [totalShows, setTotalShows] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getCountForSubscription } = useWatchlist();
  const watchlistCount = getCountForSubscription(subscription.id);
  const monthlyCost = monthlyEquivalent(subscription.amount, subscription.billing_cycle);
  const verdict = getVerdict(watchlistCount, monthlyCost);

  useEffect(() => {
    if (!subscription.tmdbProviderId) return;
    setFetching(true);
    setError(null);
    fetch(`/api/subscriptions/content?tmdbProviderId=${subscription.tmdbProviderId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setResults(data.results ?? []);
        setTotalMovies(data.totalMovies ?? 0);
        setTotalShows(data.totalShows ?? 0);
      })
      .catch(() => setError("Failed to load content"))
      .finally(() => setFetching(false));
  }, [subscription.tmdbProviderId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: "rgba(20, 8, 18, 0.97)",
          border: "1px solid rgba(255,255,255,0.10)",
          maxHeight: "92vh",
          boxShadow: "0 -8px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <RiMovieLine className="w-5 h-5 text-accent" />
            <div>
              <h2 className="font-semibold text-text-primary">{subscription.name}</h2>
              {watchlistCount > 0 && (
                <p className="text-[11px] text-text-muted mt-0.5">
                  {watchlistCount} title{watchlistCount !== 1 ? "s" : ""} on your watchlist
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        {/* Worth keeping card */}
        <div className="px-5 py-3 border-b border-white/[0.07] shrink-0">
          <div
            className="rounded-xl px-4 py-3 flex items-start gap-3"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <div className="flex-1">
              <p className={`text-sm font-semibold ${verdict.color}`}>{verdict.label}</p>
              <p className="text-[11px] text-text-muted mt-0.5">{verdict.tip}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-text-muted">
                {totalMovies > 0 && `${totalMovies.toLocaleString()} movies`}
                {totalMovies > 0 && totalShows > 0 && " · "}
                {totalShows > 0 && `${totalShows.toLocaleString()} shows`}
              </p>
              <p className="text-[10px] text-text-muted/60 mt-0.5">
                ${monthlyCost.toFixed(2)}/mo
              </p>
            </div>
          </div>
        </div>

        {/* Content grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {fetching ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {Array.from({ length: 15 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-text-muted text-sm">{error}</p>
              <button
                onClick={() => {
                  setFetching(true);
                  setError(null);
                  fetch(`/api/subscriptions/content?tmdbProviderId=${subscription.tmdbProviderId}`)
                    .then(r => r.json())
                    .then(data => {
                      if (data.error) { setError(data.error); return; }
                      setResults(data.results ?? []);
                      setTotalMovies(data.totalMovies ?? 0);
                      setTotalShows(data.totalShows ?? 0);
                    })
                    .catch(() => setError("Failed to load content"))
                    .finally(() => setFetching(false));
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-text-secondary hover:bg-white/15 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-text-muted text-sm">No content found for this service.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {results.map((item) => (
                <ContentCard key={`${item.media_type}-${item.id}`} item={item} subscriptionId={subscription.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

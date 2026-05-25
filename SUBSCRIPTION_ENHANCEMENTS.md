# Subscription Enhancements — Implementation Plan

Features ported and adapted from a standalone `subscription-tracker` app into personal-os. The goal is to bring across only what adds value on top of what personal-os already does — the content browsing, watchlist, renewal notifications, and date auto-advance. The existing `SubscriptionTracker` component, Firestore persistence, and Plaid import are all staying as-is.

---

## What's Being Added

| Feature | Value |
|---|---|
| Streaming service metadata | Auto-populates TMDb provider ID + quick links when adding known services |
| Auto-advance renewal dates | Silently fixes past `next_billing_date` in Firestore on load |
| Renewal push notifications | New `subscription_renewal` category wired into the existing cron pipeline |
| TMDb content API | Fetches what's available on a streaming service via The Movie Database |
| Watchlist | Firestore-backed list of titles you're interested in per subscription |
| Content Browser UI | Poster grid + "Worth keeping?" verdict on each streaming subscription |
| Account quick links | One-click links to Account, Billing, Cancel pages for known services |

---

## Phase 1 — Streaming Service Metadata

**Effort:** ~30 min  
**Files:** 1 new, 2 updated  
**No dependencies**

### New file: `lib/streaming-services.ts`

Registry of known streaming services with the data needed for content browsing and quick links. Intentionally separated from the existing `SubscriptionTracker` so it stays opt-in — only streaming services get this treatment, not "Utilities" or "Health & Fitness" subscriptions.

```ts
export interface StreamingQuickLink {
  label: string;
  url: string;
  description: string;
}

export interface StreamingServiceMeta {
  tmdbProviderId: number;  // TMDb watch provider ID for content discovery
  cancelUrl: string;       // Direct link to account/cancel page
  quickLinks: StreamingQuickLink[];
}

export const STREAMING_SERVICES: Record<string, StreamingServiceMeta> = {
  Netflix: {
    tmdbProviderId: 8,
    cancelUrl: 'https://www.netflix.com/account',
    quickLinks: [
      { label: 'Account Overview', url: 'https://www.netflix.com/account', description: 'Plan, billing, and account settings' },
      { label: 'Billing & Payments', url: 'https://www.netflix.com/billingactivity', description: 'View payment history and next charge date' },
      { label: 'Change Plan', url: 'https://www.netflix.com/account/changeplan', description: 'Upgrade, downgrade, or switch tiers' },
      { label: 'Cancel Membership', url: 'https://www.netflix.com/cancel', description: 'Cancel your subscription' },
    ],
  },
  'Disney+': {
    tmdbProviderId: 337,
    cancelUrl: 'https://www.disneyplus.com/account',
    quickLinks: [
      { label: 'Account', url: 'https://www.disneyplus.com/account', description: 'Manage your Disney+ account' },
      { label: 'Billing', url: 'https://www.disneyplus.com/account/subscription', description: 'View and update billing details' },
    ],
  },
  'Apple TV+': {
    tmdbProviderId: 350,
    cancelUrl: 'https://account.apple.com/subscriptions',
    quickLinks: [
      { label: 'Subscriptions', url: 'https://account.apple.com/subscriptions', description: 'Manage Apple subscriptions' },
    ],
  },
  'Prime Video': {
    tmdbProviderId: 9,
    cancelUrl: 'https://www.amazon.com/gp/video/settings/',
    quickLinks: [
      { label: 'Manage Membership', url: 'https://www.amazon.com/gp/primecentral', description: 'Amazon Prime membership settings' },
      { label: 'Video Settings', url: 'https://www.amazon.com/gp/video/settings/', description: 'Prime Video account settings' },
    ],
  },
  Max: {
    tmdbProviderId: 1899,
    cancelUrl: 'https://www.max.com/settings/subscription',
    quickLinks: [
      { label: 'Subscription', url: 'https://www.max.com/settings/subscription', description: 'Manage your Max subscription' },
    ],
  },
  Peacock: {
    tmdbProviderId: 386,
    cancelUrl: 'https://www.peacocktv.com/account',
    quickLinks: [
      { label: 'Account', url: 'https://www.peacocktv.com/account', description: 'Peacock account and billing' },
    ],
  },
  'Paramount+': {
    tmdbProviderId: 531,
    cancelUrl: 'https://www.paramountplus.com/account/subscription',
    quickLinks: [
      { label: 'Subscription', url: 'https://www.paramountplus.com/account/subscription', description: 'Manage your Paramount+ plan' },
    ],
  },
  Hulu: {
    tmdbProviderId: 15,
    cancelUrl: 'https://secure.hulu.com/account/cancel',
    quickLinks: [
      { label: 'Account', url: 'https://secure.hulu.com/account', description: 'Hulu account settings and billing' },
    ],
  },
};

// Helper — returns meta only if the name is a known streaming service
export function getStreamingMeta(name: string): StreamingServiceMeta | null {
  return STREAMING_SERVICES[name] ?? null;
}
```

### Update `types/index.ts`

Add `tmdbProviderId` as an optional field on the existing `Subscription` interface:

```ts
export interface Subscription {
  // ... existing fields ...
  tmdbProviderId?: number;  // Set for known streaming services; drives content browsing
}
```

### Update `components/subscriptions/SubscriptionForm.tsx`

Import `getStreamingMeta` and auto-populate `tmdbProviderId` and `url` when the user types a name that matches a known service. Wire into the existing `name` field's `onChange` or `onBlur` handler:

```ts
import { getStreamingMeta } from '@/lib/streaming-services';

// Inside onChange for the name field:
const meta = getStreamingMeta(value);
if (meta) {
  setForm(f => ({ ...f, name: value, tmdbProviderId: meta.tmdbProviderId, url: meta.cancelUrl }));
}
```

---

## Phase 2 — Auto-advance Renewal Dates

**Effort:** ~45 min  
**Files:** 1 updated, 1 updated  
**No dependencies**

The existing `SubscriptionTracker` shows "Overdue" correctly via `DueBadge`, but the `next_billing_date` in Firestore never advances. This means the overdue state accumulates indefinitely for active subscriptions. Fix it silently on load.

### Update `lib/recurrence.ts`

The existing file handles task cadences (daily/weekly/monthly). Extend it with subscription-specific billing cycle math. The `BillingCycle` type already exists in `types/index.ts` (weekly/monthly/quarterly/yearly).

```ts
import { addWeeks, addMonths, addYears } from 'date-fns';
import type { BillingCycle } from '@/types';

/** Advance a subscription billing date by exactly one cycle. */
export function nextSubscriptionDate(cycle: BillingCycle, from: string): string {
  const base = parseISO(from);
  switch (cycle) {
    case 'weekly':    return format(addWeeks(base, 1), 'yyyy-MM-dd');
    case 'monthly':   return format(addMonths(base, 1), 'yyyy-MM-dd');
    case 'quarterly': return format(addMonths(base, 3), 'yyyy-MM-dd');
    case 'yearly':    return format(addYears(base, 1), 'yyyy-MM-dd');
  }
}

/** Advance a past billing date forward until it's in the future. */
export function advancedBillingDate(cycle: BillingCycle, date: string): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  let d = date;
  while (d < today) {
    d = nextSubscriptionDate(cycle, d);
  }
  return d;
}
```

### Update `hooks/useSubscriptions.ts`

After the Firestore snapshot fires, silently advance any active subscription with a past `next_billing_date`:

```ts
import { advancedBillingDate } from '@/lib/recurrence';
import { updateDoc, doc } from 'firebase/firestore';

// Inside onSnapshot callback, after setSubscriptions:
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
```

No toast, no loading state — this is background cleanup.

---

## Phase 3 — Renewal Push Notifications

**Effort:** ~1.5 hrs  
**Files:** 3 updated  
**No dependencies (but Phase 2 makes this more accurate)**

### Update `types/index.ts`

Add `subscription_renewal` to both the `NotificationSettings` interface and `DEFAULT_NOTIFICATION_SETTINGS`. Uses `days_before` (same as `birthday_reminder` and `goal_deadline`):

```ts
export interface NotificationSettings {
  // ... existing 14 categories ...
  subscription_renewal: NotificationCategory;  // fires days_before next_billing_date
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  // ... existing defaults ...
  subscription_renewal: { enabled: false, time: '09:00', days_before: 3 },
};
```

### Add handler in `lib/notification-handlers.ts`

Follow the exact pattern of `goalDeadlineHandler`. Query `users/{uid}/subscriptions`, filter active ones where `next_billing_date` is within `days_before` days, build a message:

```ts
export async function subscriptionRenewalHandler(
  uid: string,
  daysBefore: number
): Promise<{ title: string; body: string; tag: string } | null> {
  const db = getAdminDb();
  const snap = await db.collection(`users/${uid}/subscriptions`)
    .where('status', '==', 'active')
    .get();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + daysBefore);
  const cutoffStr = format(cutoff, 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');

  const due = snap.docs
    .map(d => d.data() as Subscription)
    .filter(s => s.next_billing_date >= todayStr && s.next_billing_date <= cutoffStr);

  if (due.length === 0) return null;

  if (due.length === 1) {
    const s = due[0];
    const days = differenceInDays(parseISO(s.next_billing_date), today);
    return {
      title: `${s.name} renews ${days === 0 ? 'today' : `in ${days}d`}`,
      body: `$${s.amount}${cycleSuffix(s.billing_cycle)} — tap to review`,
      tag: 'subscription-renewal',
    };
  }

  const total = due.reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.billing_cycle), 0);
  return {
    title: `${due.length} subscriptions renewing soon`,
    body: `${due.map(s => s.name).join(', ')} · ~$${total.toFixed(2)}/mo`,
    tag: 'subscription-renewal',
  };
}
```

### Update `app/api/notifications/daily/route.ts`

Add the handler call alongside the existing 14 categories. It uses `days_before` like `goal_deadline` and `birthday_reminder`, and fires at the configured time:

```ts
import { subscriptionRenewalHandler } from '@/lib/notification-handlers';

// Inside the per-user loop:
if (
  settings.subscription_renewal.enabled &&
  settings.subscription_renewal.time &&
  isHour(timeInfo, settings.subscription_renewal.time)
) {
  const n = await subscriptionRenewalHandler(
    uid,
    settings.subscription_renewal.days_before ?? 3
  );
  if (n) await send(n.title, n.body, n.tag);
}
```

### Update the notifications settings UI

Wherever `NotificationSettings` is rendered (look in `components/notifications/`), add a row for `subscription_renewal`. It needs:
- Enable toggle
- Time picker
- Days-before selector (same pattern as `goal_deadline` or `birthday_reminder`)

---

## Phase 4 — TMDb Content API Route

**Effort:** ~30 min  
**Files:** 1 new  
**Requires:** `TMDB_API_KEY` in `.env.local`

### New file: `app/api/subscriptions/content/route.ts`

Port of the standalone app's content route, with one key adjustment: **remove the date filter**. The standalone app only showed content released in the last month to 3 months out, which is too narrow for a "should I keep this service?" view. Showing top-rated currently available content sorted by popularity gives a much better picture of catalog depth.

```ts
import { NextRequest, NextResponse } from 'next/server';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function getTmdbAuth(key: string): { paramStr: string; init: RequestInit } {
  if (key.startsWith('eyJ')) {
    return { paramStr: '', init: { headers: { Authorization: `Bearer ${key}` } } };
  }
  return { paramStr: `api_key=${key}`, init: {} };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tmdbProviderId = searchParams.get('tmdbProviderId');
  if (!tmdbProviderId) {
    return NextResponse.json({ error: 'tmdbProviderId required' }, { status: 400 });
  }

  const rawKey = process.env.TMDB_API_KEY;
  if (!rawKey || rawKey.trim() === '') {
    return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 503 });
  }

  const { paramStr, init } = getTmdbAuth(rawKey);
  const base = paramStr ? `${paramStr}&` : '';
  const common = `watch_region=US&with_watch_providers=${tmdbProviderId}&sort_by=popularity.desc&include_adult=false`;

  const movieUrl = `${TMDB_BASE}/discover/movie?${base}${common}`;
  const tvUrl    = `${TMDB_BASE}/discover/tv?${base}${common}`;

  try {
    const [moviesRes, tvRes] = await Promise.all([fetch(movieUrl, init), fetch(tvUrl, init)]);
    const [moviesData, tvData] = await Promise.all([moviesRes.json(), tvRes.json()]);

    if (!moviesRes.ok || !tvRes.ok) {
      const msg = moviesData?.status_message ?? tvData?.status_message ?? 'TMDb API error';
      return NextResponse.json({ error: msg }, { status: moviesRes.status || tvRes.status });
    }

    // Interleave movies and shows so neither dominates
    const movies = (moviesData.results ?? []).map((i: Record<string, unknown>) => ({ ...i, media_type: 'movie' }));
    const shows  = (tvData.results   ?? []).map((i: Record<string, unknown>) => ({ ...i, media_type: 'tv' }));
    const combined = [];
    const maxLen = Math.max(movies.length, shows.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < movies.length) combined.push(movies[i]);
      if (i < shows.length)  combined.push(shows[i]);
    }

    return NextResponse.json({
      results: combined,
      totalMovies: moviesData.total_results ?? 0,
      totalShows:  tvData.total_results   ?? 0,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch from TMDb' }, { status: 500 });
  }
}
```

### Environment variable

Add to `.env.local` (and Vercel project env vars):

```env
TMDB_API_KEY=         # Free API key from https://www.themoviedb.org/settings/api
                      # Accepts both v3 API key and v4 JWT bearer token
```

---

## Phase 5 — Watchlist Type + Hook

**Effort:** ~1 hr  
**Files:** 1 updated, 1 new  
**No dependencies**

### Update `types/index.ts`

Add `WatchlistItem` alongside the existing `Subscription` type:

```ts
// ─── Subscription Watchlist ───────────────────────────────────────────────────
export interface WatchlistItem {
  id: string;
  titleId: number;           // TMDb ID
  subscriptionId: string;    // links back to users/{uid}/subscriptions/{id}
  title: string;
  poster: string | null;     // full TMDb image URL (pre-resolved, not just path)
  media_type: 'movie' | 'tv';
  added_at: string;          // ISO timestamp
}
```

### New file: `hooks/useWatchlist.ts`

Real-time Firestore listener. Follows the exact same pattern as every other hook in the app (`useSubscriptions`, `useBooks`, etc.):

```ts
"use client";
import { useEffect, useState, useCallback } from 'react';
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { WatchlistItem } from '@/types';

export function useWatchlist() {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, 'users', user.uid, 'watchlist'),
      (snap) => {
        setWatchlist(snap.docs.map(d => ({ id: d.id, ...d.data() } as WatchlistItem)));
        setLoading(false);
      }
    );
  }, [user]);

  const isOnWatchlist = useCallback(
    (titleId: number, subscriptionId: string) =>
      watchlist.some(w => w.titleId === titleId && w.subscriptionId === subscriptionId),
    [watchlist]
  );

  const toggleWatchlistItem = useCallback(
    async (item: Omit<WatchlistItem, 'id'>) => {
      if (!user) return false;
      const existing = watchlist.find(
        w => w.titleId === item.titleId && w.subscriptionId === item.subscriptionId
      );
      if (existing) {
        await deleteDoc(doc(db, 'users', user.uid, 'watchlist', existing.id));
        return false;
      } else {
        await addDoc(collection(db, 'users', user.uid, 'watchlist'), item);
        return true;
      }
    },
    [user, watchlist]
  );

  const getCountForSubscription = useCallback(
    (subscriptionId: string) =>
      watchlist.filter(w => w.subscriptionId === subscriptionId).length,
    [watchlist]
  );

  return { watchlist, loading, isOnWatchlist, toggleWatchlistItem, getCountForSubscription };
}
```

### Firestore collection

Stored at `users/{uid}/watchlist/{docId}`. No Firestore index needed — filtering is done client-side since watchlists are small. Add to the Firestore data structure docs:

```
users/{uid}/
└── watchlist/{itemId}   # WatchlistItem — title bookmarks per streaming subscription
```

---

## Phase 6 — Content Browser UI

**Effort:** ~3–4 hrs  
**Files:** 1 new, 1 updated  
**Requires:** Phases 1, 4, 5

This is the main lift. A slide-in panel (or full modal — match personal-os's existing pattern for similar things, e.g. `SubscriptionForm`) that opens when you click "Browse" on a streaming subscription.

### New file: `components/subscriptions/ContentBrowser.tsx`

Structure:

```
ContentBrowser (panel/modal)
├── Header — service name, "X titles on your watchlist", close button
├── WorthKeepingCard — verdict based on watchlist count vs. monthly cost
├── Content grid (poster cards)
│   └── ContentCard (per title)
│       ├── Poster image
│       ├── Movie/TV badge, rating badge
│       └── Hover overlay
│           ├── Plot summary (line-clamped)
│           └── "Interested" toggle button
└── Loading skeleton / error / empty states
```

**WorthKeepingCard logic:**

```ts
function getVerdict(watchlistCount: number, monthlyCost: number) {
  if (watchlistCount === 0) return { label: 'No watchlist items yet', color: 'text-text-muted', tip: 'Mark titles you want to watch to see your value score.' };
  const perTitle = monthlyCost / watchlistCount;
  if (perTitle < 3)  return { label: 'Great value', color: 'text-success', tip: `$${perTitle.toFixed(2)} per title you care about` };
  if (perTitle < 8)  return { label: 'Decent value', color: 'text-warning', tip: `$${perTitle.toFixed(2)} per title you care about` };
  return { label: 'Consider cancelling', color: 'text-danger', tip: `$${perTitle.toFixed(2)} per title you care about — not much on your list` };
}
```

**Component props:**

```ts
interface ContentBrowserProps {
  subscription: Subscription;
  onClose: () => void;
}
```

**Key implementation notes:**
- Call `/api/subscriptions/content?tmdbProviderId=${subscription.tmdbProviderId}` on mount
- Use `useWatchlist()` for watchlist state; pass `subscription.id` as `subscriptionId` when toggling
- TMDb image base URL: `https://image.tmdb.org/t/p/w342`
- Title field: `media_type === 'movie' ? item.title : item.name`
- Year: `media_type === 'movie' ? item.release_date?.slice(0,4) : item.first_air_date?.slice(0,4)`

### Update `components/subscriptions/SubscriptionTracker.tsx`

Two additions to the existing subscription row:

1. **Watchlist count badge** — import `useWatchlist`, call `getCountForSubscription(sub.id)`, show a small badge on the row if count > 0:

```tsx
import { useWatchlist } from '@/hooks/useWatchlist';
const { getCountForSubscription } = useWatchlist();

// In the row, next to StatusBadge:
{getCountForSubscription(sub.id) > 0 && (
  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
    ★ {getCountForSubscription(sub.id)}
  </span>
)}
```

2. **Browse button** — visible only when `sub.tmdbProviderId` is set (i.e. it's a known streaming service):

```tsx
import { getStreamingMeta } from '@/lib/streaming-services';

// In the actions group (alongside Edit/Delete):
{sub.tmdbProviderId && (
  <button
    onClick={() => setContentSub(sub)}
    className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
    title="Browse content"
  >
    <RiMovieLine className="w-3.5 h-3.5" />
  </button>
)}
```

Add local state `const [contentSub, setContentSub] = useState<Subscription | null>(null)` and render `ContentBrowser` conditionally at the bottom of the component.

---

## Phase 7 — Account Quick Links

**Effort:** ~45 min  
**Files:** 1 updated  
**Requires:** Phase 1

Surface quick links from `lib/streaming-services.ts` in the subscription UI. Two good places:

**Option A (simpler):** In `SubscriptionForm`, show read-only links when editing a known streaming service — lets the user jump to account settings without leaving the form.

**Option B (richer):** Add a small expandable "Quick Links" section to the subscription row in `SubscriptionTracker`, visible on hover or tap. Uses `getStreamingMeta(sub.name)?.quickLinks`.

Either way the implementation is the same: read from `STREAMING_SERVICES[sub.name]?.quickLinks` and render anchor tags. No new state, no API calls.

---

## Implementation Order

Work through phases in this sequence — later phases depend on earlier ones:

```
Phase 1 (metadata)     → no dependencies, do first
Phase 2 (auto-advance) → no dependencies, do alongside Phase 1
Phase 3 (notifications)→ no dependencies, standalone, do next
Phase 4 (TMDb API)     → no dependencies, prerequisite for Phase 6
Phase 5 (watchlist)    → no dependencies, prerequisite for Phase 6
Phase 6 (content UI)   → requires Phases 1, 4, 5
Phase 7 (quick links)  → requires Phase 1, drop in last
```

Phases 1–3 are all self-contained and low-risk. They improve the subscription module immediately without touching the content browsing path at all. Do those first and ship them before starting the UI work.

---

## File Change Summary

| File | Action | Phase |
|---|---|---|
| `lib/streaming-services.ts` | Create | 1 |
| `types/index.ts` | Add `tmdbProviderId?` to `Subscription`, add `WatchlistItem`, add `subscription_renewal` to `NotificationSettings` | 1, 3, 5 |
| `components/subscriptions/SubscriptionForm.tsx` | Auto-populate on known service name | 1 |
| `lib/recurrence.ts` | Add `nextSubscriptionDate`, `advancedBillingDate` | 2 |
| `hooks/useSubscriptions.ts` | Auto-advance past dates after snapshot | 2 |
| `lib/notification-handlers.ts` | Add `subscriptionRenewalHandler` | 3 |
| `app/api/notifications/daily/route.ts` | Wire in renewal handler | 3 |
| `components/notifications/` | Add `subscription_renewal` row to settings UI | 3 |
| `.env.local` | Add `TMDB_API_KEY` | 4 |
| `app/api/subscriptions/content/route.ts` | Create | 4 |
| `hooks/useWatchlist.ts` | Create | 5 |
| `components/subscriptions/ContentBrowser.tsx` | Create | 6 |
| `components/subscriptions/SubscriptionTracker.tsx` | Add watchlist badges + Browse button + ContentBrowser | 6 |

// Review cards — AI-native spaced repetition.
// Instead of rigid SM-2 interval scheduling, Claude picks which card to surface
// based on relevance to the current session. This lib handles storage, querying,
// and interval math; Claude handles the selection and framing.
//
// Firestore path: users/{uid}/review_cards/{cardId}

import { getAdminDb } from "@/lib/firebase-admin";

export interface ReviewCard {
  id: string;
  source_type: "book_highlight" | "journal_insight" | "second_brain" | "manual";
  source_id: string;       // bookId, journal entry id, second_brain doc id, or "manual"
  source_title: string;    // human-readable: book title, journal date, vault path
  text: string;
  created_at: string;      // ISO timestamp
  last_surfaced_at: string | null;
  next_review_date: string; // YYYY-MM-DD — when the card is eligible for review
  interval_days: number;   // current spacing (days); grows on positive recall
  times_reviewed: number;
  tags?: string[];
}

export async function getCardsForReview(uid: string, today: string, limit = 5): Promise<ReviewCard[]> {
  const db = getAdminDb();
  const snap = await db.collection(`users/${uid}/review_cards`)
    .where("next_review_date", "<=", today)
    .orderBy("next_review_date", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewCard));
}

export async function addReviewCard(
  uid: string,
  card: Omit<ReviewCard, "id">,
): Promise<string> {
  const db = getAdminDb();
  const ref = await db.collection(`users/${uid}/review_cards`).add(card);
  return ref.id;
}

// Simple interval progression:
//   remembered → double the interval (cap 90 days)
//   fuzzy      → keep interval, schedule from today
//   forgotten  → reset to 1 day
export async function advanceCard(
  uid: string,
  cardId: string,
  result: "remembered" | "fuzzy" | "forgotten",
  today: string,
): Promise<void> {
  const db = getAdminDb();
  const doc = await db.doc(`users/${uid}/review_cards/${cardId}`).get();
  if (!doc.exists) return;
  const card = doc.data() as ReviewCard;

  let nextInterval: number;
  if (result === "remembered") nextInterval = Math.min((card.interval_days ?? 1) * 2, 90);
  else if (result === "fuzzy") nextInterval = Math.max(card.interval_days ?? 3, 3);
  else nextInterval = 1;

  const nextDate = new Date(today + "T12:00:00");
  nextDate.setDate(nextDate.getDate() + nextInterval);

  await doc.ref.update({
    last_surfaced_at: new Date().toISOString(),
    next_review_date: nextDate.toISOString().slice(0, 10),
    interval_days: nextInterval,
    times_reviewed: (card.times_reviewed ?? 0) + 1,
  });
}

// Returns a compact block for injection into morning briefing and context snapshot.
// Claude uses this as a cue to weave the most relevant insight into the session.
export async function getReviewCardContext(uid: string, today: string): Promise<string | null> {
  try {
    const cards = await getCardsForReview(uid, today, 5);
    if (!cards.length) return null;
    const lines = cards.map((c) => {
      const excerpt = c.text.length > 140 ? c.text.slice(0, 137) + "…" : c.text;
      return `  [${c.id}] "${excerpt}" — ${c.source_title}`;
    });
    return `Review cards due (${cards.length}):\n${lines.join("\n")}`;
  } catch {
    return null;
  }
}

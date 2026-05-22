import { doc, collection, addDoc, updateDoc, setDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getLevelInfo } from "@/lib/xp";
import type { XPEventType } from "@/types";
import toast from "react-hot-toast";

export async function awardXP(
  uid: string,
  amount: number,
  type: XPEventType,
  description: string,
  currentTotal: number
) {
  const prevLevel = getLevelInfo(currentTotal).level;
  const summaryRef = doc(db, `users/${uid}/xp/summary`);

  // updateDoc is the canonical pattern for incrementing an existing doc;
  // setDoc(merge) + increment has a known quirk where the onSnapshot may not
  // reflect the update until the next full re-subscribe.
  try {
    await updateDoc(summaryRef, { total: increment(amount) });
  } catch {
    // Doc doesn't exist yet (new user) — create it
    await setDoc(summaryRef, { total: Math.max(0, amount) });
  }

  // Log event
  await addDoc(collection(db, `users/${uid}/xp_events`), {
    type,
    xp: amount,
    description,
    timestamp: new Date().toISOString(),
  });

  // Check for level up
  const newLevel = getLevelInfo(currentTotal + amount).level;
  if (newLevel > prevLevel) {
    const { title } = getLevelInfo(currentTotal + amount);
    toast(`🎉 Level Up! You're now Level ${newLevel} — ${title}`, {
      duration: 4000,
      style: { fontWeight: "600" },
    });
  } else if (amount >= 0) {
    toast(`⚡ +${amount} XP`, { duration: 1500, style: { fontSize: "0.85rem" } });
  } else {
    toast(`−${Math.abs(amount)} XP`, { duration: 1500, style: { fontSize: "0.85rem", opacity: "0.7" } });
  }
}

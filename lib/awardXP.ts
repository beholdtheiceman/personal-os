import { doc, collection, addDoc, setDoc, increment } from "firebase/firestore";
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

  // Increment summary doc
  await setDoc(
    doc(db, `users/${uid}/xp/summary`),
    { total: increment(amount) },
    { merge: true }
  );

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

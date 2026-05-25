import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ACHIEVEMENT_MAP } from "@/lib/achievements";
import type { AchievementId } from "@/types";
import toast from "react-hot-toast";

function playUnlockSound() {
  try {
    const audio = new Audio("/sounds/achievement-unlock.mp3");
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {
    // Silently ignore — browser may block autoplay
  }
}

export async function checkAndAward(
  uid: string,
  id: AchievementId
): Promise<boolean> {
  const def = ACHIEVEMENT_MAP[id];
  if (!def) return false;

  const ref = doc(db, `users/${uid}/achievements/${id}`);
  const snap = await getDoc(ref);
  if (snap.exists()) return false;

  await setDoc(ref, {
    id,
    unlockedAt: new Date().toISOString(),
    gamerscore: def.gamerscore,
  });

  playUnlockSound();
  toast(`🏆 Achievement Unlocked: ${def.title} +${def.gamerscore}G`, {
    duration: 5000,
    style: { fontWeight: "600" },
  });

  // Check The Completionist after every unlock
  if (id !== "the_completionist") {
    const allSnaps = await getDocs(collection(db, `users/${uid}/achievements`));
    if (allSnaps.size >= 40) {
      await checkAndAward(uid, "the_completionist");
    }
  }

  return true;
}

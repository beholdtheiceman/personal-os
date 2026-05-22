"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { RiCake2Line, RiGiftLine } from "react-icons/ri";
import type { Person } from "@/types";

interface UpcomingBirthday {
  person: Person;
  daysUntil: number;
  nextBirthday: string; // YYYY-MM-DD
}

function getUpcomingBirthdays(people: Person[], withinDays = 30): UpcomingBirthday[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const results: UpcomingBirthday[] = [];

  for (const p of people) {
    if (!p.birthday) continue;
    const [, month, day] = p.birthday.split("-").map(Number);
    // Try this year and next
    for (const yearOffset of [0, 1]) {
      const next = new Date(today.getFullYear() + yearOffset, month - 1, day);
      const diff = Math.round((next.getTime() - today.getTime()) / 86_400_000);
      if (diff >= 0 && diff <= withinDays) {
        results.push({ person: p, daysUntil: diff, nextBirthday: next.toLocaleDateString("en-CA") });
        break;
      }
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

export default function BirthdayWidget() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, `users/${user.uid}/people`), (snap) => {
      setPeople(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Person)));
      setLoaded(true);
    });
    return unsub;
  }, [user]);

  if (!loaded) return null;

  const upcoming = getUpcomingBirthdays(people, 30);
  if (upcoming.length === 0) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RiCake2Line className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text-primary">Upcoming Birthdays</span>
        </div>
        <Link href="/people" className="text-xs text-text-muted hover:text-accent transition-colors">
          People →
        </Link>
      </div>

      <div className="space-y-2">
        {upcoming.slice(0, 5).map(({ person, daysUntil }) => (
          <div key={person.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-semibold shrink-0">
                {person.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">{person.name}</p>
                {person.gift_ideas && person.gift_ideas.length > 0 && (
                  <p className="text-xs text-text-muted flex items-center gap-1 truncate">
                    <RiGiftLine className="w-3 h-3 shrink-0" />
                    {person.gift_ideas.slice(0, 2).join(", ")}
                  </p>
                )}
              </div>
            </div>
            <span className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded-full ${
              daysUntil === 0
                ? "bg-accent/20 text-accent"
                : daysUntil <= 7
                ? "bg-warning/10 text-warning"
                : "bg-white/5 text-text-muted"
            }`}>
              {daysUntil === 0 ? "Today! 🎂" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

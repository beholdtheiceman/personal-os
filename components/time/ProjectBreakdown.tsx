"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import type { Project } from "@/types";

function fmtH(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function ProjectBreakdown() {
  const { user } = useAuth();
  const { entries } = useTimeTracker();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "projects"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)));
    });
  }, [user]);

  // Entries that have a project_id
  const byProject = entries.reduce<Record<string, number>>((acc, e) => {
    if (e.project_id) acc[e.project_id] = (acc[e.project_id] ?? 0) + e.duration_min;
    return acc;
  }, {});

  const unlinked = entries.filter((e) => !e.project_id).reduce((s, e) => s + e.duration_min, 0);

  const projectRows = Object.entries(byProject)
    .map(([id, min]) => ({
      id,
      name: projects.find((p) => p.id === id)?.name ?? "Unknown Project",
      min,
    }))
    .sort((a, b) => b.min - a.min);

  const maxMin = Math.max(...projectRows.map((r) => r.min), unlinked, 1);

  if (projectRows.length === 0 && unlinked === 0) {
    return <p className="text-sm text-text-muted text-center py-8">No time entries in the last 7 days.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Hours by Project (7 days)</p>
      {projectRows.map((row) => (
        <div key={row.id} className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary truncate">{row.name}</span>
            <span className="text-text-muted ml-2 shrink-0">{fmtH(row.min)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
            <div className="h-full rounded-full bg-accent/70 transition-all" style={{ width: `${(row.min / maxMin) * 100}%` }} />
          </div>
        </div>
      ))}
      {unlinked > 0 && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted italic">Unlinked</span>
            <span className="text-text-muted ml-2 shrink-0">{fmtH(unlinked)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
            <div className="h-full rounded-full bg-bg-border transition-all" style={{ width: `${(unlinked / maxMin) * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

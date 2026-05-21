"use client";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePeople, isOverdue, daysSince } from "@/hooks/usePeople";
import PersonForm from "@/components/people/PersonForm";
import PersonDetail from "@/components/people/PersonDetail";
import {
  RiAddLine, RiSearchLine, RiUserHeartLine, RiTimeLine,
  RiPhoneLine, RiMailLine, RiGoogleLine,
} from "react-icons/ri";
import type { Person, RelationshipType } from "@/types";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";

const REL_COLORS: Record<string, string> = {
  friend:       "bg-blue-500/20 text-blue-300 border-blue-500/30",
  family:       "bg-rose-500/20 text-rose-300 border-rose-500/30",
  colleague:    "bg-amber-500/20 text-amber-300 border-amber-500/30",
  acquaintance: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  other:        "bg-white/10 text-text-secondary border-white/20",
};

const FILTER_TABS = ["all", "friend", "family", "colleague", "acquaintance", "other"] as const;
type FilterTab = typeof FILTER_TABS[number];

function ContactDaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-text-muted">Never contacted</span>;
  if (days === 0) return <span className="text-xs text-success">Today</span>;
  if (days <= 7) return <span className="text-xs text-success">{days}d ago</span>;
  if (days <= 30) return <span className="text-xs text-amber-400">{days}d ago</span>;
  return <span className="text-xs text-danger">{days}d ago</span>;
}

export default function PeoplePage() {
  const { user } = useAuth();
  const { people, loading } = usePeople();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showForm, setShowForm] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [viewPerson, setViewPerson] = useState<Person | null>(null);

  useEffect(() => {
    const imported = searchParams.get("imported");
    const skipped  = searchParams.get("skipped");
    const error    = searchParams.get("error");
    if (imported !== null) toast.success(`Imported ${imported} contacts${skipped ? ` (${skipped} already existed)` : ""}`);
    if (error === "contacts_oauth_denied") toast.error("Google Contacts access denied");
    if (error === "contacts_import_failed") toast.error("Failed to import contacts");
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = people;
    if (filter !== "all") list = list.filter((p) => p.relationship === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.company?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [people, filter, search]);

  const overdue = useMemo(() => people.filter(isOverdue), [people]);
  const upcoming = useMemo(() =>
    people.filter((p) => p.follow_up_date && p.follow_up_date >= new Date().toLocaleDateString("en-CA"))
      .sort((a, b) => (a.follow_up_date ?? "") < (b.follow_up_date ?? "") ? -1 : 1)
      .slice(0, 5),
    [people]
  );

  if (loading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary mb-1">People</h1>
          <p className="text-text-secondary text-sm">Track relationships, interactions, and follow-ups.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/people/contacts-auth?uid=${user?.uid}`}
            className="btn-ghost flex items-center gap-2 text-sm"
            title="Import from Google Contacts"
          >
            <RiGoogleLine className="w-4 h-4" /> Import contacts
          </a>
          <button onClick={() => { setEditPerson(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
            <RiAddLine className="w-4 h-4" /> Add person
          </button>
        </div>
      </div>

      {/* Attention sections */}
      {(overdue.length > 0 || upcoming.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overdue.length > 0 && (
            <div className="card">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
                <RiUserHeartLine className="w-3.5 h-3.5 text-danger" />
                <span className="text-danger">Needs attention</span>
                <span className="text-text-muted font-normal">({overdue.length})</span>
              </h2>
              <div className="space-y-2">
                {overdue.slice(0, 5).map((p) => (
                  <button key={p.id} onClick={() => setViewPerson(p)} className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] text-left transition-colors">
                    <div className="w-7 h-7 rounded-full bg-danger/20 flex items-center justify-center text-danger text-xs font-semibold shrink-0">
                      {p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{p.name}</p>
                      <p className="text-xs text-danger">{daysSince(p.last_contacted)}d since last contact</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="card">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
                <RiTimeLine className="w-3.5 h-3.5 text-accent" /> Upcoming follow-ups
              </h2>
              <div className="space-y-2">
                {upcoming.map((p) => (
                  <button key={p.id} onClick={() => setViewPerson(p)} className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] text-left transition-colors">
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-semibold shrink-0">
                      {p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{p.name}</p>
                      {p.follow_up_note && <p className="text-xs text-text-muted truncate">{p.follow_up_note}</p>}
                    </div>
                    <span className="text-xs text-accent shrink-0">
                      {format(parseISO(p.follow_up_date!), "MMM d")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search + filter */}
      <div className="space-y-3">
        <div className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            className="input-base w-full pl-9"
            placeholder="Search by name, company, or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1 p-1 bg-bg-tertiary rounded-xl w-fit border border-white/[0.12] flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === tab
                  ? "bg-accent/40 text-white shadow-sm"
                  : "bg-white/[0.08] text-text-secondary hover:bg-white/[0.15] hover:text-text-primary"
              }`}
            >
              {tab === "all" ? `All (${people.length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* People grid */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <RiUserHeartLine className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary text-sm">
            {people.length === 0
              ? "No contacts yet. Add someone to start tracking your relationships."
              : "No contacts match your search."}
          </p>
          {people.length === 0 && (
            <button onClick={() => setShowForm(true)} className="btn-primary mt-4 text-sm">Add your first contact</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((person) => {
            const days = daysSince(person.last_contacted);
            const overduePerson = isOverdue(person);
            return (
              <button
                key={person.id}
                onClick={() => setViewPerson(person)}
                className="card text-left hover:border-accent/30 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${overduePerson ? "bg-danger/20 text-danger" : "bg-accent/20 text-accent"}`}>
                    {person.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-text-primary truncate">{person.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md capitalize border ${REL_COLORS[person.relationship]}`}>
                        {person.relationship}
                      </span>
                      {person.company && (
                        <span className="text-[10px] text-text-muted truncate">{person.company}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <ContactDaysBadge days={days} />
                  <div className="flex items-center gap-2">
                    {person.email && <RiMailLine className="w-3.5 h-3.5 text-text-muted" />}
                    {person.phone && <RiPhoneLine className="w-3.5 h-3.5 text-text-muted" />}
                    {person.follow_up_date && <RiTimeLine className="w-3.5 h-3.5 text-accent" />}
                  </div>
                </div>

                {person.tags && person.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {person.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent/80">{t}</span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <PersonForm person={editPerson} onClose={() => { setShowForm(false); setEditPerson(null); }} />
      )}
      {viewPerson && (
        <PersonDetail
          person={viewPerson}
          onEdit={() => { setEditPerson(viewPerson); setViewPerson(null); setShowForm(true); }}
          onClose={() => setViewPerson(null)}
          onDeleted={() => setViewPerson(null)}
        />
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { addDoc, updateDoc, deleteDoc, doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptions, monthlyEquivalent } from "@/hooks/useSubscriptions";
import { usePlaid } from "@/hooks/usePlaid";
import SubscriptionForm from "./SubscriptionForm";
import ContentBrowser from "./ContentBrowser";
import { getStreamingMeta } from "@/lib/streaming-services";
import { useWatchlist } from "@/hooks/useWatchlist";
import {
  RiAddLine, RiEditLine, RiDeleteBinLine, RiRefreshLine,
  RiCalendarLine, RiCheckLine, RiPauseLine, RiCloseLine,
  RiLinksLine, RiArrowDownSLine, RiArrowUpSLine, RiMovieLine,
} from "react-icons/ri";
import { format, differenceInDays } from "date-fns";
import toast from "react-hot-toast";
import type { Subscription } from "@/types";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function cycleSuffix(cycle: string) {
  const map: Record<string, string> = { weekly: "/wk", monthly: "/mo", quarterly: "/qtr", yearly: "/yr" };
  return map[cycle] ?? "";
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:    "bg-success/20 text-success",
    paused:    "bg-warning/20 text-warning",
    cancelled: "bg-danger/20 text-danger",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${styles[status] ?? "bg-white/10 text-text-muted"}`}>
      {status}
    </span>
  );
}

function DueBadge({ dateStr }: { dateStr: string }) {
  const days = differenceInDays(new Date(dateStr + "T12:00:00"), new Date());
  if (days < 0)  return <span className="text-[10px] text-danger">Overdue</span>;
  if (days === 0) return <span className="text-[10px] text-warning font-medium">Due today</span>;
  if (days <= 7)  return <span className="text-[10px] text-warning">In {days}d</span>;
  return <span className="text-[10px] text-text-muted">{format(new Date(dateStr + "T12:00:00"), "MMM d")}</span>;
}

export default function SubscriptionTracker() {
  const { user } = useAuth();
  const { subscriptions, active, loading, monthlyTotal, yearlyTotal } = useSubscriptions();
  const { recurring: plaidRecurring } = usePlaid();
  const { getCountForSubscription } = useWatchlist();
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState<Subscription | null>(null);
  const [contentSub, setContentSub]   = useState<Subscription | null>(null);
  const [filter, setFilter]           = useState<"all" | "active" | "cancelled">("active");
  const [importing, setImporting]     = useState(false);
  const [expandedLinks, setExpandedLinks] = useState<string | null>(null);

  const handleSave = async (data: Omit<Subscription, "id">) => {
    if (!user) return;
    if (editing) {
      await updateDoc(doc(db, "users", user.uid, "subscriptions", editing.id), data as object);
      toast.success("Subscription updated");
    } else {
      await addDoc(collection(db, "users", user.uid, "subscriptions"), data);
      toast.success("Subscription added");
    }
    setEditing(null);
  };

  const handleDelete = async (sub: Subscription) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "subscriptions", sub.id));
    toast.success(`${sub.name} removed`);
  };

  // Plaid recurring streams not yet linked to a subscription
  const linkedStreamIds = new Set(subscriptions.map((s) => s.plaid_stream_id).filter(Boolean));
  const unlinkedPlaid = plaidRecurring.filter(
    (r) => r.is_active && !linkedStreamIds.has(r.stream_id)
  );

  const importFromPlaid = async (stream: typeof plaidRecurring[0]) => {
    if (!user) return;
    setImporting(true);
    const resolvedName = stream.merchant_name || stream.description || stream.institution || "Unknown";
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const nextDate = stream.last_date ?? today;
      await addDoc(collection(db, "users", user.uid, "subscriptions"), {
        name: resolvedName,
        category: "Other",
        amount: stream.amount,
        billing_cycle: stream.frequency === "ANNUALLY" ? "yearly"
          : stream.frequency === "WEEKLY" ? "weekly"
          : stream.frequency === "BIWEEKLY" ? "weekly"
          : "monthly",
        next_billing_date: nextDate,
        start_date: stream.first_date ?? today,
        status: "active",
        plaid_stream_id: stream.stream_id,
        created_at: new Date().toISOString(),
      });
      toast.success(`${resolvedName} imported`);
    } finally {
      setImporting(false);
    }
  };

  const filtered = subscriptions.filter((s) =>
    filter === "all" ? true : filter === "active" ? s.status === "active" : s.status === "cancelled"
  );

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Monthly", value: fmt(monthlyTotal) },
          { label: "Yearly est.", value: fmt(yearlyTotal) },
          { label: "Active", value: String(active.length) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-3 text-center" style={{ background: "rgba(255,255,255,0.06)" }}>
            <p className="text-lg font-semibold text-text-primary">{value}</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Import from Plaid */}
      {unlinkedPlaid.length > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(196,114,138,0.08)", border: "1px solid rgba(196,114,138,0.20)" }}>
          <p className="text-xs font-semibold text-accent uppercase tracking-wide">
            Detected by Plaid — import as subscriptions?
          </p>
          <div className="space-y-2">
            {unlinkedPlaid.map((r) => (
              <div key={r.stream_id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{r.merchant_name || r.description || r.institution || "Unknown"}</p>
                  <p className="text-xs text-text-muted">{fmt(r.amount)} · {r.frequency.toLowerCase()}</p>
                </div>
                <button
                  onClick={() => importFromPlaid(r)}
                  disabled={importing}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                >
                  + Import
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        {/* Filter tabs */}
        <div className="flex gap-1 p-1 bg-bg-tertiary rounded-xl border border-white/[0.12]">
          {(["active", "all", "cancelled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === f ? "bg-accent/40 text-white" : "bg-white/[0.12] text-text-secondary hover:bg-white/[0.20] hover:text-text-primary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary flex items-center gap-1.5 text-sm">
          <RiAddLine className="w-4 h-4" /> Add
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-text-muted text-sm">
          No subscriptions yet.{" "}
          <button onClick={() => setShowForm(true)} className="text-accent">Add one</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((sub) => (
            <div
              key={sub.id}
              className="rounded-xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-3 group">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text-primary truncate">{sub.name || "Unknown"}</span>
                    <StatusBadge status={sub.status} />
                    {sub.plaid_stream_id && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">Plaid</span>
                    )}
                    {getCountForSubscription(sub.id) > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                        ★ {getCountForSubscription(sub.id)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-muted">{sub.category}</span>
                    <span className="text-text-muted">·</span>
                    <RiCalendarLine className="w-3 h-3 text-text-muted" />
                    <DueBadge dateStr={sub.next_billing_date} />
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-text-primary">
                    {fmt(sub.amount)}<span className="text-xs font-normal text-text-muted">{cycleSuffix(sub.billing_cycle)}</span>
                  </p>
                  {sub.billing_cycle !== "monthly" && (
                    <p className="text-[10px] text-text-muted">{fmt(monthlyEquivalent(sub.amount, sub.billing_cycle))}/mo</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {sub.tmdbProviderId && (
                    <button
                      onClick={() => setContentSub(sub)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                      title="Browse content"
                    >
                      <RiMovieLine className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {getStreamingMeta(sub.name) && (
                    <button
                      onClick={() => setExpandedLinks(expandedLinks === sub.id ? null : sub.id)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                      title="Quick links"
                    >
                      <RiLinksLine className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => { setEditing(sub); setShowForm(true); }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                  >
                    <RiEditLine className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(sub)}
                    className="p-1.5 rounded-lg hover:bg-danger/20 text-text-muted hover:text-danger transition-colors"
                  >
                    <RiDeleteBinLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Links panel — shown when expanded */}
              {expandedLinks === sub.id && getStreamingMeta(sub.name) && (
                <div className="px-4 pb-3 pt-2 border-t border-white/[0.07]">
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1.5">Quick Links</p>
                  <div className="flex flex-wrap gap-2">
                    {getStreamingMeta(sub.name)!.quickLinks.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={link.description}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/[0.07] hover:bg-white/[0.12] text-text-secondary hover:text-text-primary transition-colors"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <SubscriptionForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Content browser */}
      {contentSub && (
        <ContentBrowser
          subscription={contentSub}
          onClose={() => setContentSub(null)}
        />
      )}
    </div>
  );
}

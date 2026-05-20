"use client";
import { useState, useEffect } from "react";
import { RiCloseLine } from "react-icons/ri";
import type { Subscription, SubscriptionCategory, BillingCycle, SubscriptionStatus } from "@/types";

const CATEGORIES: SubscriptionCategory[] = [
  "Entertainment", "Productivity", "Health & Fitness", "Finance",
  "Utilities", "Food & Drink", "Gaming", "News & Media", "Shopping", "Other",
];

const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "weekly",    label: "Weekly" },
  { value: "monthly",   label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly",    label: "Yearly" },
];

interface Props {
  initial?: Partial<Subscription>;
  onSave: (data: Omit<Subscription, "id">) => Promise<void>;
  onClose: () => void;
}

export default function SubscriptionForm({ initial, onSave, onClose }: Props) {
  const today = new Date().toLocaleDateString("en-CA");

  const [name, setName]           = useState(initial?.name ?? "");
  const [category, setCategory]   = useState<SubscriptionCategory>(initial?.category ?? "Entertainment");
  const [amount, setAmount]       = useState(String(initial?.amount ?? ""));
  const [cycle, setCycle]         = useState<BillingCycle>(initial?.billing_cycle ?? "monthly");
  const [nextDate, setNextDate]   = useState(initial?.next_billing_date ?? today);
  const [startDate, setStartDate] = useState(initial?.start_date ?? today);
  const [status, setStatus]       = useState<SubscriptionStatus>(initial?.status ?? "active");
  const [url, setUrl]             = useState(initial?.url ?? "");
  const [notes, setNotes]         = useState(initial?.notes ?? "");
  const [saving, setSaving]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      category,
      amount: parseFloat(amount),
      billing_cycle: cycle,
      next_billing_date: nextDate,
      start_date: startDate,
      status,
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
      plaid_stream_id: initial?.plaid_stream_id,
      created_at: initial?.created_at ?? new Date().toISOString(),
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: "rgba(20, 8, 18, 0.96)", border: "1px solid rgba(255,255,255,0.10)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold text-text-primary">{initial?.id ? "Edit Subscription" : "Add Subscription"}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors">
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">Service name *</label>
            <input className="input-base" placeholder="Netflix, Spotify…" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {/* Category + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Category</label>
              <select className="input-base" value={category} onChange={(e) => setCategory(e.target.value as SubscriptionCategory)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Status</label>
              <select className="input-base" value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Amount + Cycle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Amount (USD) *</label>
              <input className="input-base" type="number" min="0" step="0.01" placeholder="9.99" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Billing cycle</label>
              <select className="input-base" value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycle)}>
                {CYCLES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Next billing date *</label>
              <input className="input-base" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Start date</label>
              <input className="input-base" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">Website (optional)</label>
            <input className="input-base" type="url" placeholder="https://netflix.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">Notes (optional)</label>
            <input className="input-base" placeholder="Family plan, shared with…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 btn-ghost text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 btn-primary text-sm">
              {saving ? "Saving…" : initial?.id ? "Save changes" : "Add subscription"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

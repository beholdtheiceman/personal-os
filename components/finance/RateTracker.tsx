"use client";
import { useState } from "react";
import { useRateTracker } from "@/hooks/useRateTracker";
import type { RankedOffer, RateProfile } from "@/lib/rate-tracker";

const TYPE_LABELS: Record<string, string> = {
  savings_apy: "Savings APY",
  cd_apy: "CD APY",
  checking_bonus: "Checking Bonus",
  credit_card_bonus: "Credit Card Bonus",
  brokerage_bonus: "Brokerage Bonus",
  other: "Other",
};

const SOURCE_LABELS: Record<string, string> = {
  doctor_of_credit: "Doctor of Credit",
  reddit_churning: "r/churning",
  reddit_personalfinance: "r/personalfinance",
};

type Filter = "all" | "eligible" | "savings" | "bonus";

function OfferCard({ offer, onToggleTaken }: { offer: RankedOffer; onToggleTaken: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isApy = offer.type === "savings_apy" || offer.type === "cd_apy";

  return (
    <div className={`card p-4 space-y-2 ${offer.taken ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-text-secondary">
              {TYPE_LABELS[offer.type] ?? offer.type}
            </span>
            {offer.eligibility.eligible ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Eligible</span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Not eligible</span>
            )}
            {offer.taken && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">Applied</span>
            )}
          </div>
          <p className="text-text-primary font-medium mt-1 line-clamp-2">{offer.title}</p>
          <p className="text-text-secondary text-xs mt-0.5">{offer.institution} · {SOURCE_LABELS[offer.source] ?? offer.source}</p>
        </div>
        <div className="text-right shrink-0">
          {isApy && offer.apy != null && (
            <p className="text-xl font-bold text-accent">{offer.apy.toFixed(2)}%</p>
          )}
          {!isApy && offer.bonus_amount != null && (
            <p className="text-xl font-bold text-accent">${offer.bonus_amount.toLocaleString()}</p>
          )}
          {offer.eligibility.estimated_value > 0 && (
            <p className="text-xs text-text-secondary">~${Math.round(offer.eligibility.estimated_value).toLocaleString()} value</p>
          )}
        </div>
      </div>

      {offer.eligibility.warnings.length > 0 && (
        <div className="space-y-0.5">
          {offer.eligibility.warnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-400">⚠ {w}</p>
          ))}
        </div>
      )}

      {expanded && (
        <div className="text-xs text-text-secondary space-y-1 pt-1 border-t border-white/10">
          {offer.minimum_balance != null && <p>Min balance: ${offer.minimum_balance.toLocaleString()}</p>}
          {offer.spend_requirement != null && (
            <p>Spend ${offer.spend_requirement.toLocaleString()} in {offer.spend_timeframe_days}d</p>
          )}
          {offer.direct_deposit_required && <p>Direct deposit required</p>}
          {offer.new_customer_only && <p>New customers only</p>}
          {offer.expires_at && <p>Expires {offer.expires_at}</p>}
          <p>Scraped {new Date(offer.scraped_at).toLocaleDateString()}</p>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {expanded ? "Less" : "Details"}
        </button>
        <a
          href={offer.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline"
        >
          View offer ↗
        </a>
        <button
          onClick={() => onToggleTaken(offer.id)}
          className="ml-auto text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {offer.taken ? "Undo applied" : "Mark applied"}
        </button>
      </div>
    </div>
  );
}

function ProfileForm({ profile, onSave }: { profile: RateProfile | null; onSave: (p: Partial<RateProfile>) => Promise<void> }) {
  const [institutions, setInstitutions] = useState(profile?.existing_institutions.join(", ") ?? "");
  const [cards24mo, setCards24mo] = useState(String(profile?.cards_opened_24mo ?? 0));
  const [balance, setBalance] = useState(String(profile?.deployable_balance ?? 0));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      existing_institutions: institutions.split(",").map(s => s.trim()).filter(Boolean),
      cards_opened_24mo: parseInt(cards24mo) || 0,
      current_cards: profile?.current_cards ?? [],
      deployable_balance: parseFloat(balance) || 0,
    });
    setSaving(false);
  };

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-semibold text-text-primary">Your Profile</h3>
      <p className="text-xs text-text-secondary">Used to rank and filter offers by eligibility.</p>
      <div className="space-y-2">
        <label className="block">
          <span className="text-xs text-text-secondary mb-1 block">Existing institutions (comma-separated)</span>
          <input
            className="input w-full text-sm"
            value={institutions}
            onChange={e => setInstitutions(e.target.value)}
            placeholder="Chase, SoFi, Marcus…"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs text-text-secondary mb-1 block">Cards opened (24 mo)</span>
            <input
              className="input w-full text-sm"
              type="number"
              value={cards24mo}
              onChange={e => setCards24mo(e.target.value)}
              min={0}
            />
          </label>
          <label className="block">
            <span className="text-xs text-text-secondary mb-1 block">Deployable balance ($)</span>
            <input
              className="input w-full text-sm"
              type="number"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              min={0}
            />
          </label>
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary text-sm"
      >
        {saving ? "Saving…" : "Save Profile"}
      </button>
    </div>
  );
}

export default function RateTracker() {
  const { offers, profile, loading, syncing, sync, saveProfile, toggleTaken } = useRateTracker();
  const [filter, setFilter] = useState<Filter>("eligible");
  const [showProfile, setShowProfile] = useState(false);

  const filtered = offers.filter(o => {
    if (filter === "eligible") return !o.taken && o.eligibility.eligible;
    if (filter === "savings") return !o.taken && (o.type === "savings_apy" || o.type === "cd_apy");
    if (filter === "bonus") return !o.taken && (o.type === "checking_bonus" || o.type === "credit_card_bonus" || o.type === "brokerage_bonus");
    return true;
  });

  if (loading) return <div className="card p-6 text-text-secondary text-sm">Loading offers…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold text-text-primary">Rate &amp; Bonus Tracker</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowProfile(p => !p)}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {showProfile ? "Hide profile" : "Edit profile"}
          </button>
          <button
            onClick={sync}
            disabled={syncing}
            className="btn-secondary text-sm"
          >
            {syncing ? "Syncing…" : "Sync offers"}
          </button>
        </div>
      </div>

      {showProfile && (
        <ProfileForm profile={profile} onSave={saveProfile} />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-bg-tertiary rounded-xl w-fit border border-white/[0.12]">
        {([
          { key: "eligible", label: "Eligible" },
          { key: "savings",  label: "Savings / CD" },
          { key: "bonus",    label: "Bonuses" },
          { key: "all",      label: "All" },
        ] as { key: Filter; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? "bg-accent/40 text-white shadow-sm"
                : "bg-white/[0.12] text-text-secondary hover:bg-white/[0.20] hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-6 text-center text-text-secondary text-sm">
          {offers.length === 0
            ? 'No offers yet. Click "Sync offers" to fetch the latest.'
            : "No offers match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(offer => (
            <OfferCard key={offer.id} offer={offer} onToggleTaken={toggleTaken} />
          ))}
        </div>
      )}
    </div>
  );
}

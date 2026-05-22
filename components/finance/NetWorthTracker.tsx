"use client";
import { useState, useEffect } from "react";
import { RiAddLine, RiDeleteBinLine, RiArrowUpLine, RiArrowDownLine } from "react-icons/ri";
import { useNetWorth } from "@/hooks/useNetWorth";
import { format } from "date-fns";
import type { AssetEntry, LiabilityEntry, AssetCategory, LiabilityCategory } from "@/types";

function fmt(n: number, signed = false) {
  const s = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.abs(n));
  if (signed) return (n >= 0 ? "+" : "-") + s;
  return n < 0 ? "-" + s : s;
}

const ASSET_CATEGORIES: AssetCategory[] = ["cash", "investment", "property", "other"];
const LIABILITY_CATEGORIES: LiabilityCategory[] = ["loan", "credit_card", "mortgage", "other"];

// ── Trend Chart ───────────────────────────────────────────────────────────────
function TrendChart({ snapshots }: { snapshots: { snapshot_date: string; net_worth: number }[] }) {
  if (snapshots.length < 2) return null;
  const W = 560;
  const H = 100;
  const PAD = { top: 12, right: 16, bottom: 20, left: 8 };
  const IW = W - PAD.left - PAD.right;
  const IH = H - PAD.top - PAD.bottom;

  const values = snapshots.map((s) => s.net_worth);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const x = (i: number) => PAD.left + (i / (snapshots.length - 1)) * IW;
  const y = (v: number) => PAD.top + IH - ((v - min) / range) * IH;

  const pathD = snapshots.reduce(
    (acc, s, i) => acc + (i === 0 ? `M ${x(i)} ${y(s.net_worth)}` : ` L ${x(i)} ${y(s.net_worth)}`),
    ""
  );

  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];
  const positive = latest.net_worth >= (prev?.net_worth ?? 0);

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Net Worth Trend</p>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 240 }}>
          <path d={pathD} fill="none" stroke={positive ? "#34d399" : "#f87171"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
          {snapshots.map((s, i) => (
            <circle key={i} cx={x(i)} cy={y(s.net_worth)} r={3} fill={positive ? "#34d399" : "#f87171"} opacity={0.9} />
          ))}
          {snapshots.map((s, i) => (
            <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.3)">
              {s.snapshot_date.slice(5)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── Row editors ───────────────────────────────────────────────────────────────
interface AssetRowProps {
  name: string;
  entry: AssetEntry;
  onChange: (name: string, entry: AssetEntry) => void;
  onRemove: () => void;
}
function AssetRow({ name, entry, onChange, onRemove }: AssetRowProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="input-base flex-1 text-xs py-1 px-2"
        value={name}
        onChange={(e) => onChange(e.target.value, entry)}
        placeholder="Name"
      />
      <select
        className="input-base text-xs py-1 px-2"
        value={entry.category}
        onChange={(e) => onChange(name, { ...entry, category: e.target.value as AssetCategory })}
      >
        {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <span className="text-xs text-text-muted">$</span>
      <input
        type="number"
        min={0}
        className="input-base w-28 text-xs py-1 px-2"
        value={entry.value || ""}
        onChange={(e) => onChange(name, { ...entry, value: parseFloat(e.target.value) || 0 })}
      />
      <button onClick={onRemove} className="text-text-muted hover:text-red-400"><RiDeleteBinLine className="w-3.5 h-3.5" /></button>
    </div>
  );
}

interface LiabilityRowProps {
  name: string;
  entry: LiabilityEntry;
  onChange: (name: string, entry: LiabilityEntry) => void;
  onRemove: () => void;
}
function LiabilityRow({ name, entry, onChange, onRemove }: LiabilityRowProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        className="input-base flex-1 text-xs py-1 px-2"
        value={name}
        onChange={(e) => onChange(e.target.value, entry)}
        placeholder="Name"
      />
      <select
        className="input-base text-xs py-1 px-2"
        value={entry.category}
        onChange={(e) => onChange(name, { ...entry, category: e.target.value as LiabilityCategory })}
      >
        {LIABILITY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <span className="text-xs text-text-muted">$</span>
      <input
        type="number"
        min={0}
        className="input-base w-28 text-xs py-1 px-2"
        value={entry.value || ""}
        onChange={(e) => onChange(name, { ...entry, value: parseFloat(e.target.value) || 0 })}
      />
      <button onClick={onRemove} className="text-text-muted hover:text-red-400"><RiDeleteBinLine className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NetWorthTracker() {
  const { snapshots, current, previous, loading, currentMonth, saveSnapshot } = useNetWorth();

  const [assets, setAssets] = useState<Record<string, AssetEntry>>({});
  const [liabilities, setLiabilities] = useState<Record<string, LiabilityEntry>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Initialize editor from current month's snapshot, or carry forward from previous
  useEffect(() => {
    if (loading) return;
    if (current) {
      setAssets(current.assets);
      setLiabilities(current.liabilities);
    } else if (previous) {
      setAssets(previous.assets);
      setLiabilities(previous.liabilities);
      setDirty(true); // carried forward — treat as unsaved
    }
  }, [loading, current, previous]);

  const totalAssets = Object.values(assets).reduce((s, a) => s + (a.value || 0), 0);
  const totalLiabilities = Object.values(liabilities).reduce((s, l) => s + (l.value || 0), 0);
  const netWorth = totalAssets - totalLiabilities;
  const prevNetWorth = current ? null : previous?.net_worth ?? null;

  const updateAsset = (oldName: string, newName: string, entry: AssetEntry) => {
    setAssets((prev) => {
      const next = { ...prev };
      if (oldName !== newName) delete next[oldName];
      next[newName] = entry;
      return next;
    });
    setDirty(true);
  };

  const removeAsset = (name: string) => {
    setAssets((prev) => { const next = { ...prev }; delete next[name]; return next; });
    setDirty(true);
  };

  const addAsset = () => {
    const key = `Asset ${Object.keys(assets).length + 1}`;
    setAssets((prev) => ({ ...prev, [key]: { value: 0, category: "cash" } }));
    setDirty(true);
  };

  const updateLiability = (oldName: string, newName: string, entry: LiabilityEntry) => {
    setLiabilities((prev) => {
      const next = { ...prev };
      if (oldName !== newName) delete next[oldName];
      next[newName] = entry;
      return next;
    });
    setDirty(true);
  };

  const removeLiability = (name: string) => {
    setLiabilities((prev) => { const next = { ...prev }; delete next[name]; return next; });
    setDirty(true);
  };

  const addLiability = () => {
    const key = `Liability ${Object.keys(liabilities).length + 1}`;
    setLiabilities((prev) => ({ ...prev, [key]: { value: 0, category: "loan" } }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveSnapshot(assets, liabilities);
    setDirty(false);
    setSaving(false);
  };

  if (loading) return <div className="py-8 text-center text-text-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex flex-wrap gap-6 pb-4 border-b border-bg-border">
        <div>
          <p className="text-xs text-text-muted">Total Assets</p>
          <p className="text-xl font-bold text-success">{fmt(totalAssets)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Total Liabilities</p>
          <p className="text-xl font-bold text-red-400">{fmt(totalLiabilities)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Net Worth</p>
          <p className={`text-xl font-bold ${netWorth >= 0 ? "text-text-primary" : "text-red-400"}`}>{fmt(netWorth)}</p>
        </div>
        {prevNetWorth !== null && (
          <div className="flex items-center gap-1 self-end pb-1">
            {netWorth >= prevNetWorth
              ? <RiArrowUpLine className="w-4 h-4 text-success" />
              : <RiArrowDownLine className="w-4 h-4 text-red-400" />}
            <span className={`text-sm font-medium ${netWorth >= prevNetWorth ? "text-success" : "text-red-400"}`}>
              {fmt(netWorth - prevNetWorth, true)} vs last month
            </span>
          </div>
        )}
      </div>

      {/* Trend chart */}
      {snapshots.length >= 2 && <TrendChart snapshots={snapshots} />}

      {/* Month label */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {format(new Date(currentMonth + "-01"), "MMMM yyyy")} Snapshot
          {!current && previous && <span className="ml-2 text-amber-400 normal-case font-normal">(carried from last month)</span>}
        </p>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-xs py-1 px-3 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save snapshot"}
          </button>
        )}
      </div>

      {/* Assets */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Assets</p>
        {Object.entries(assets).map(([name, entry]) => (
          <AssetRow
            key={name}
            name={name}
            entry={entry}
            onChange={(newName, newEntry) => updateAsset(name, newName, newEntry)}
            onRemove={() => removeAsset(name)}
          />
        ))}
        <button onClick={addAsset} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-text">
          <RiAddLine className="w-3.5 h-3.5" /> Add asset
        </button>
      </div>

      {/* Liabilities */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Liabilities</p>
        {Object.entries(liabilities).map(([name, entry]) => (
          <LiabilityRow
            key={name}
            name={name}
            entry={entry}
            onChange={(newName, newEntry) => updateLiability(name, newName, newEntry)}
            onRemove={() => removeLiability(name)}
          />
        ))}
        <button onClick={addLiability} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-text">
          <RiAddLine className="w-3.5 h-3.5" /> Add liability
        </button>
      </div>
    </div>
  );
}

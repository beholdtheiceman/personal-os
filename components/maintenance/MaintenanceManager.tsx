"use client";
import { useState } from "react";
import {
  RiCarLine, RiHomeLine, RiShieldCheckLine, RiAddLine,
  RiDeleteBinLine, RiCheckLine,
} from "react-icons/ri";
import { useMaintenance, isOverdue, isDueSoon } from "@/hooks/useMaintenance";
import type { MaintenanceCategory, MaintenanceItem } from "@/types";

type Tab = "home" | "vehicle" | "warranty";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "home",     label: "Home",     icon: RiHomeLine },
  { id: "vehicle",  label: "Vehicles", icon: RiCarLine },
  { id: "warranty", label: "Warranty", icon: RiShieldCheckLine },
];

const HOME_PRESETS = [
  { name: "HVAC Filter",            interval_days: 90  },
  { name: "Smoke Detector Battery", interval_days: 365 },
  { name: "Gutter Cleaning",        interval_days: 180 },
  { name: "Water Heater Flush",     interval_days: 365 },
  { name: "Pest Control",           interval_days: 90  },
  { name: "Roof Inspection",        interval_days: 365 },
];

const VEHICLE_PRESETS = [
  { name: "Oil Change",        interval_days: 90  },
  { name: "Tire Rotation",     interval_days: 180 },
  { name: "Registration",      interval_days: 365 },
  { name: "Insurance Renewal", interval_days: 365 },
  { name: "Inspection",        interval_days: 365 },
];

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonthsStr(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function StatusBadge({ item }: { item: MaintenanceItem }) {
  if (isOverdue(item))  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-danger/15 text-danger font-medium">Overdue</span>;
  if (isDueSoon(item))  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">Due soon</span>;
  return null;
}

interface FormState {
  name: string; vehicle_name: string; last_service: string; interval_days: string;
  next_due: string; purchase_date: string; warranty_months: string; retailer: string; notes: string;
}
const EMPTY: FormState = { name: "", vehicle_name: "", last_service: "", interval_days: "", next_due: "", purchase_date: "", warranty_months: "", retailer: "", notes: "" };

export default function MaintenanceManager() {
  const { items, logs, loading, addItem, updateItem, logService } = useMaintenance();
  const [tab, setTab] = useState<Tab>("home");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logNotes, setLogNotes] = useState("");
  const [logCost, setLogCost] = useState("");
  const [logContractor, setLogContractor] = useState("");

  const f = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const visible = items.filter((i) => i.status === "active" && i.category === tab);
  const itemLogs = loggingId ? logs.filter((l) => l.item_id === loggingId).slice(0, 5) : [];

  function applyPreset(preset: { name: string; interval_days: number }) {
    setForm((prev) => ({ ...prev, name: preset.name, interval_days: String(preset.interval_days) }));
    setShowAdd(true);
  }

  async function handleAdd() {
    if (!form.name.trim()) return;
    const next_due = form.next_due ||
      (form.last_service && form.interval_days
        ? addDaysStr(form.last_service, Number(form.interval_days))
        : undefined);
    const warranty_expires =
      tab === "warranty" && form.purchase_date && form.warranty_months
        ? addMonthsStr(form.purchase_date, Number(form.warranty_months))
        : undefined;
    await addItem({
      name: form.name.trim(),
      category: tab as MaintenanceCategory,
      vehicle_name: form.vehicle_name.trim() || undefined,
      last_service: form.last_service || undefined,
      interval_days: form.interval_days ? Number(form.interval_days) : undefined,
      next_due,
      purchase_date: form.purchase_date || undefined,
      warranty_months: form.warranty_months ? Number(form.warranty_months) : undefined,
      warranty_expires,
      retailer: form.retailer.trim() || undefined,
      notes: form.notes.trim() || undefined,
      status: "active",
    });
    setForm(EMPTY);
    setShowAdd(false);
  }

  async function handleLog(item: MaintenanceItem) {
    await logService(item.id, logDate, {
      notes: logNotes || undefined,
      cost: logCost ? Number(logCost) : undefined,
      contractor: logContractor || undefined,
    });
    setLoggingId(null);
    setLogDate(new Date().toISOString().slice(0, 10));
    setLogNotes(""); setLogCost(""); setLogContractor("");
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-bg-secondary p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setShowAdd(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === id ? "bg-accent/20 text-accent" : "text-text-secondary hover:text-text-primary"
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Quick-add presets */}
      {!showAdd && (
        <div className="flex flex-wrap gap-2">
          {(tab === "vehicle" ? VEHICLE_PRESETS : tab === "home" ? HOME_PRESETS : []).map((p) => (
            <button key={p.name} onClick={() => applyPreset(p)}
              className="text-xs px-2.5 py-1 rounded-lg border border-bg-border text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors">
              + {p.name}
            </button>
          ))}
          <button onClick={() => { setForm(EMPTY); setShowAdd(true); }}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
            <RiAddLine className="w-3 h-3" /> Custom
          </button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
            {tab === "warranty" ? "Add Warranty" : "Add Item"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Name *</label>
              <input value={form.name} onChange={f("name")} placeholder={tab === "warranty" ? "e.g. Refrigerator" : "e.g. Oil Change"}
                className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
            {tab === "vehicle" && (
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Vehicle</label>
                <input value={form.vehicle_name} onChange={f("vehicle_name")} placeholder="e.g. 2020 Honda Civic"
                  className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
              </div>
            )}
            {tab !== "warranty" ? (
              <>
                <div>
                  <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Last Service</label>
                  <input type="date" value={form.last_service} onChange={f("last_service")}
                    className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Interval (days)</label>
                  <input type="number" value={form.interval_days} onChange={f("interval_days")} placeholder="e.g. 90"
                    className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Next Due (override)</label>
                  <input type="date" value={form.next_due} onChange={f("next_due")}
                    className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Purchase Date</label>
                  <input type="date" value={form.purchase_date} onChange={f("purchase_date")}
                    className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Warranty (months)</label>
                  <input type="number" value={form.warranty_months} onChange={f("warranty_months")} placeholder="e.g. 12"
                    className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Retailer</label>
                  <input value={form.retailer} onChange={f("retailer")} placeholder="e.g. Best Buy"
                    className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Notes</label>
              <input value={form.notes} onChange={f("notes")} placeholder="Optional notes"
                className="w-full bg-bg-tertiary border border-bg-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!form.name.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium disabled:opacity-40 hover:bg-accent/90 transition-colors">
              <RiCheckLine className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={() => { setShowAdd(false); setForm(EMPTY); }}
              className="px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-muted text-xs hover:text-text-primary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Item list */}
      {loading ? (
        <p className="text-xs text-text-muted text-center py-8">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-8">No {tab} items yet — add one above.</p>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => (
            <div key={item.id} className="card py-3 px-4 group">
              {loggingId === item.id ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-text-primary">Log service — {item.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Date</label>
                      <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
                        className="w-full bg-bg-tertiary border border-bg-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Cost ($)</label>
                      <input type="number" value={logCost} onChange={(e) => setLogCost(e.target.value)} placeholder="Optional"
                        className="w-full bg-bg-tertiary border border-bg-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Contractor</label>
                      <input value={logContractor} onChange={(e) => setLogContractor(e.target.value)} placeholder="Who did it?"
                        className="w-full bg-bg-tertiary border border-bg-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted uppercase tracking-wide mb-1 block">Notes</label>
                      <input value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder="Optional"
                        className="w-full bg-bg-tertiary border border-bg-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent" />
                    </div>
                  </div>
                  {itemLogs.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-muted uppercase tracking-wide">Previous service</p>
                      {itemLogs.map((l) => (
                        <div key={l.id} className="flex items-center gap-3 text-xs text-text-secondary">
                          <span className="shrink-0">{l.date}</span>
                          {l.cost != null && <span>${l.cost}</span>}
                          {l.contractor && <span>{l.contractor}</span>}
                          {l.notes && <span className="truncate text-text-muted">{l.notes}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => handleLog(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-medium hover:bg-success/25 transition-colors">
                      <RiCheckLine className="w-3.5 h-3.5" /> Confirm
                    </button>
                    <button onClick={() => setLoggingId(null)}
                      className="px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-muted text-xs hover:text-text-primary transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-text-primary">{item.name}</span>
                      {item.vehicle_name && <span className="text-[10px] text-text-muted">{item.vehicle_name}</span>}
                      <StatusBadge item={item} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-text-muted">
                      {item.last_service && <span>Last: {item.last_service}</span>}
                      {item.next_due && (
                        <span className={isOverdue(item) ? "text-danger" : isDueSoon(item) ? "text-warning" : ""}>
                          Due: {item.next_due}
                        </span>
                      )}
                      {item.warranty_expires && <span>Expires: {item.warranty_expires}</span>}
                      {item.retailer && <span>{item.retailer}</span>}
                      {item.notes && <span className="truncate">{item.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {tab !== "warranty" && (
                      <button
                        onClick={() => { setLoggingId(item.id); setLogDate(new Date().toISOString().slice(0, 10)); }}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
                      >
                        <RiCheckLine className="w-3 h-3" /> Done
                      </button>
                    )}
                    <button onClick={() => updateItem(item.id, { status: "archived" })}
                      className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-danger transition-colors">
                      <RiDeleteBinLine className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

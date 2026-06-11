"use client";
import Link from "next/link";
import { RiCarLine, RiHomeLine, RiShieldCheckLine, RiAlertLine } from "react-icons/ri";
import { useMaintenance, isOverdue } from "@/hooks/useMaintenance";
import type { MaintenanceItem } from "@/types";

function ItemIcon({ item }: { item: MaintenanceItem }) {
  if (item.category === "vehicle")  return <RiCarLine className="w-3.5 h-3.5 shrink-0" />;
  if (item.category === "warranty") return <RiShieldCheckLine className="w-3.5 h-3.5 shrink-0" />;
  return <RiHomeLine className="w-3.5 h-3.5 shrink-0" />;
}

export default function MaintenanceWidget() {
  const { dueSoon, overdue, loading } = useMaintenance();
  const urgent = [...overdue, ...dueSoon].slice(0, 4);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-2">
          <RiCarLine className="w-3.5 h-3.5" /> Maintenance
        </h2>
        <Link href="/home" className="text-xs text-accent hover:text-accent-text">View all</Link>
      </div>
      {loading ? (
        <p className="text-xs text-text-muted py-2">Loading…</p>
      ) : urgent.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-4">All caught up — nothing due soon.</p>
      ) : (
        <div className="space-y-2">
          {overdue.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-danger mb-1">
              <RiAlertLine className="w-3.5 h-3.5" />
              <span>{overdue.length} item{overdue.length !== 1 ? "s" : ""} overdue</span>
            </div>
          )}
          {urgent.map((item) => (
            <Link key={item.id} href="/home"
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-bg-tertiary transition-colors">
              <span className={isOverdue(item) ? "text-danger" : "text-warning"}>
                <ItemIcon item={item} />
              </span>
              <span className="flex-1 text-sm text-text-primary truncate">{item.name}</span>
              {item.vehicle_name && <span className="text-[10px] text-text-muted shrink-0">{item.vehicle_name}</span>}
              {item.next_due && (
                <span className={`text-[10px] shrink-0 ${isOverdue(item) ? "text-danger" : "text-warning"}`}>
                  {item.next_due}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

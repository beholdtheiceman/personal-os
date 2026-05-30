"use client";
import Link from "next/link";
import { RiFireLine, RiArrowRightLine } from "react-icons/ri";
import { useFireProjection } from "@/hooks/useFireProjection";
import { formatTimeToFi } from "@/lib/fire-calculator";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function FireWidget() {
  const { projection, loading } = useFireProjection();

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RiFireLine className="text-[#C4728A]" />
          <span className="text-sm font-semibold text-text-primary">FIRE Progress</span>
        </div>
        <Link
          href="/finance?tab=fire"
          className="flex items-center gap-1 text-xs text-text-muted hover:text-[#C4728A] transition-colors"
        >
          View <RiArrowRightLine />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-white/10 rounded w-full" />
          <div className="h-3 bg-white/10 rounded w-2/3" />
        </div>
      ) : !projection ? (
        <p className="text-xs text-text-muted">Add net worth data to see your FIRE projection.</p>
      ) : (
        <>
          {/* Progress bar */}
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.min(100, projection.progress_pct)}%`,
                background: "linear-gradient(90deg, #C4728A, #e08fa0)",
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-text-muted">
            <span>{fmt(projection.current_net_worth)}</span>
            <span className="font-medium text-[#C4728A]">{projection.progress_pct.toFixed(1)}%</span>
            <span>{fmt(projection.fi_number)}</span>
          </div>

          {projection.months_to_fi === null && projection.current_net_worth >= projection.fi_number ? (
            <p className="text-xs font-semibold text-emerald-400">Already FI! 🎉</p>
          ) : projection.projected_fi_date ? (
            <p className="text-xs text-text-secondary">
              ~{formatTimeToFi(projection.months_to_fi)} &middot; {fmtDate(projection.projected_fi_date)}
            </p>
          ) : (
            <p className="text-xs text-text-muted">Add transactions to project timeline.</p>
          )}
        </>
      )}
    </div>
  );
}

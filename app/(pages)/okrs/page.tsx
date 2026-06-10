"use client";
import OKRManager from "@/components/okrs/OKRManager";

export default function OKRsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary mb-1">OKRs</h1>
        <p className="text-text-secondary text-sm">Quarterly objectives and key results — the altitude above goals.</p>
      </div>
      <OKRManager />
    </div>
  );
}

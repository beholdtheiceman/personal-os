"use client";
import FinanceTracker from "@/components/finance/FinanceTracker";

export default function FinancePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Finance</h1>
      <p className="text-text-secondary text-sm mb-6">Track income, expenses, and monthly cash flow.</p>
      <FinanceTracker />
    </div>
  );
}

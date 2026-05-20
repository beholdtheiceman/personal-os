"use client";
import FinanceTracker from "@/components/finance/FinanceTracker";
import PlaidConnect from "@/components/plaid/PlaidConnect";

export default function FinancePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Finance</h1>
        <p className="text-text-secondary text-sm">Track income, expenses, and monthly cash flow.</p>
      </div>

      {/* Plaid — connected accounts + recurring charges */}
      <div className="card">
        <PlaidConnect />
      </div>

      <FinanceTracker />
    </div>
  );
}

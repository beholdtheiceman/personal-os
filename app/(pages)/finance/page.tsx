"use client";
import { useState } from "react";
import FinanceTracker from "@/components/finance/FinanceTracker";
import PlaidConnect from "@/components/plaid/PlaidConnect";
import SubscriptionTracker from "@/components/subscriptions/SubscriptionTracker";

type Tab = "transactions" | "subscriptions" | "accounts";

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("transactions");

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Finance</h1>
        <p className="text-text-secondary text-sm">Track income, expenses, subscriptions, and connected accounts.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-bg-tertiary rounded-xl w-fit">
        {([
          { key: "transactions",  label: "Transactions" },
          { key: "subscriptions", label: "Subscriptions" },
          { key: "accounts",      label: "Accounts" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-accent/25 text-accent shadow-sm" : "bg-white/8 text-text-secondary hover:bg-white/12 hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "transactions"  && <FinanceTracker />}
      {tab === "subscriptions" && (
        <div className="card">
          <SubscriptionTracker />
        </div>
      )}
      {tab === "accounts" && (
        <div className="card">
          <PlaidConnect />
        </div>
      )}
    </div>
  );
}

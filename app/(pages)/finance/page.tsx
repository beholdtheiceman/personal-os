"use client";
import { useState } from "react";
import FinanceTracker from "@/components/finance/FinanceTracker";
import PlaidConnect from "@/components/plaid/PlaidConnect";
import SubscriptionTracker from "@/components/subscriptions/SubscriptionTracker";
import BudgetTracker from "@/components/finance/BudgetTracker";
import NetWorthTracker from "@/components/finance/NetWorthTracker";
import SavingsGoals from "@/components/finance/SavingsGoals";

type Tab = "transactions" | "budget" | "net-worth" | "savings" | "subscriptions" | "accounts";

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("transactions");

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-text-primary mb-1">Finance</h1>
        <p className="text-text-secondary text-sm">Track income, expenses, budget, net worth, and subscriptions.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex flex-wrap gap-1 p-1 bg-bg-tertiary rounded-xl w-fit border border-white/[0.12]">
        {([
          { key: "transactions",  label: "Transactions" },
          { key: "budget",        label: "Budget" },
          { key: "net-worth",     label: "Net Worth" },
          { key: "savings",       label: "Savings" },
          { key: "subscriptions", label: "Subscriptions" },
          { key: "accounts",      label: "Accounts" },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-accent/40 text-white shadow-sm" : "bg-white/[0.12] text-text-secondary hover:bg-white/[0.20] hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "transactions"  && <FinanceTracker />}
      {tab === "budget" && (
        <div className="card">
          <BudgetTracker />
        </div>
      )}
      {tab === "net-worth" && (
        <div className="card">
          <NetWorthTracker />
        </div>
      )}
      {tab === "savings" && (
        <div className="card">
          <SavingsGoals />
        </div>
      )}
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

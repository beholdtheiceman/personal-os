"use client";
import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { RiAddLine, RiDeleteBinLine, RiEditLine, RiArrowUpLine, RiArrowDownLine, RiMoneyDollarCircleLine } from "react-icons/ri";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePlaid } from "@/hooks/usePlaid";
import TransactionForm from "./TransactionForm";
import type { Transaction } from "@/types";

const PLAID_CATEGORY_LABELS: Record<string, string> = {
  INCOME: "Income", TRANSFER_IN: "Transfer In", TRANSFER_OUT: "Transfer Out",
  LOAN_PAYMENTS: "Loan Payments", BANK_FEES: "Bank Fees", ENTERTAINMENT: "Entertainment",
  FOOD_AND_DRINK: "Food & Drink", GENERAL_MERCHANDISE: "Shopping", HOME_IMPROVEMENT: "Home",
  MEDICAL: "Medical", PERSONAL_CARE: "Personal Care", GENERAL_SERVICES: "Services",
  GOVERNMENT_AND_NON_PROFIT: "Government", TRANSPORTATION: "Transportation",
  TRAVEL: "Travel", RENT_AND_UTILITIES: "Utilities",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function FinanceTracker() {
  const { user } = useAuth();
  const [manualTransactions, setManualTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [viewMonth, setViewMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const { plaidTransactions } = usePlaid();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "transactions"), orderBy("date", "desc"), limit(200));
    return onSnapshot(q, (snap) => {
      setManualTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction)));
    });
  }, [user]);

  // Normalize Plaid transactions into the shared Transaction shape
  const normalizedPlaid = useMemo<Transaction[]>(() =>
    plaidTransactions.map((p) => ({
      id: p.transaction_id,
      date: p.date,
      type: (p.amount < 0 ? "income" : "expense") as Transaction["type"],
      category: PLAID_CATEGORY_LABELS[p.category] ?? p.category,
      amount: Math.abs(p.amount),
      description: p.merchant_name || p.institution || "Unknown",
      source: "plaid" as const,
      pending: p.pending,
    })),
  [plaidTransactions]);

  const transactions = useMemo(() =>
    [...manualTransactions, ...normalizedPlaid].sort((a, b) => b.date.localeCompare(a.date)),
  [manualTransactions, normalizedPlaid]);

  const handleSave = async (data: Partial<Transaction>) => {
    if (!user) return;
    if (editing) {
      await updateDoc(doc(db, "users", user.uid, "transactions", editing.id), data);
    } else {
      await addDoc(collection(db, "users", user.uid, "transactions"), {
        ...data,
        source: "manual",
        logged_at: Timestamp.now(),
      });
    }
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "transactions", id));
  };

  // Filter to selected month
  const monthTransactions = useMemo(() => {
    const start = startOfMonth(parseISO(`${viewMonth}-01`));
    const end = endOfMonth(start);
    return transactions.filter((t) => {
      try { return isWithinInterval(parseISO(t.date), { start, end }); }
      catch { return false; }
    });
  }, [transactions, viewMonth]);

  const totalIncome = monthTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = monthTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = totalIncome - totalExpense;

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions.filter((t) => t.type === "expense").forEach((t) => {
      map[t.category] = (map[t.category] ?? 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthTransactions]);

  // Month nav
  const changeMonth = (delta: number) => {
    const d = parseISO(`${viewMonth}-01`);
    d.setMonth(d.getMonth() + delta);
    setViewMonth(format(d, "yyyy-MM"));
  };

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => changeMonth(-1)} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors">
            <RiArrowUpLine className="w-4 h-4 rotate-[-90deg]" />
          </button>
          <span className="text-sm font-semibold text-text-primary min-w-[120px] text-center">
            {format(parseISO(`${viewMonth}-01`), "MMMM yyyy")}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors">
            <RiArrowUpLine className="w-4 h-4 rotate-90" />
          </button>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm flex items-center gap-1.5">
          <RiAddLine className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-xs text-text-muted mb-1">Income</p>
          <p className="text-lg font-bold text-success">{fmt(totalIncome)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-text-muted mb-1">Expenses</p>
          <p className="text-lg font-bold text-danger">{fmt(totalExpense)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-text-muted mb-1">Net</p>
          <p className={`text-lg font-bold ${net >= 0 ? "text-success" : "text-danger"}`}>{fmt(net)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Transaction list */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Transactions</h3>
          {monthTransactions.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <RiMoneyDollarCircleLine className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-xs text-text-muted">No transactions this month.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {monthTransactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-bg-secondary group transition-colors">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    t.type === "income" ? "bg-success/15" : "bg-danger/15"
                  }`}>
                    {t.type === "income"
                      ? <RiArrowDownLine className="w-4 h-4 text-success" />
                      : <RiArrowUpLine className="w-4 h-4 text-danger" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-text-primary truncate">{t.description || t.category}</span>
                      <span className="text-[10px] text-text-muted shrink-0">{t.category}</span>
                      {t.source === "plaid" && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-accent/20 text-accent shrink-0">
                          {t.pending ? "Pending" : "Plaid"}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-text-muted">{format(parseISO(t.date), "MMM d")}</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${t.type === "income" ? "text-success" : "text-text-primary"}`}>
                    {t.type === "expense" ? "−" : "+"}{fmt(t.amount)}
                  </span>
                  {t.source !== "plaid" && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(t); setShowForm(true); }} className="p-1 text-text-muted hover:text-accent">
                        <RiEditLine className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(t.id)} className="p-1 text-text-muted hover:text-danger">
                        <RiDeleteBinLine className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expense breakdown */}
        {expenseByCategory.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Expense Breakdown</h3>
            <div className="space-y-2.5">
              {expenseByCategory.map(([cat, amount]) => {
                const pct = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-text-secondary">{cat}</span>
                      <span className="text-text-primary font-medium tabular-nums">{fmt(amount)}</span>
                    </div>
                    <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                      <div className="h-full bg-danger/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <TransactionForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

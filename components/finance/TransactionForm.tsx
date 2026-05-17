"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import LoadingDots from "@/components/ui/LoadingDots";
import type { Transaction } from "@/types";

const EXPENSE_CATEGORIES = ["Food", "Transport", "Housing", "Utilities", "Health", "Shopping", "Entertainment", "Education", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Investment", "Gift", "Other"];

interface TransactionFormProps {
  initial?: Transaction;
  onSave: (data: Partial<Transaction>) => Promise<void>;
  onClose: () => void;
}

export default function TransactionForm({ initial, onSave, onClose }: TransactionFormProps) {
  const [type, setType] = useState<Transaction["type"]>(initial?.type ?? "expense");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0 || !category) return;
    setSaving(true);
    try {
      await onSave({ type, amount: parseFloat(amount), category, description: description.trim(), date });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit Transaction" : "Add Transaction"} onClose={onClose}>
      <div className="space-y-4">
        {/* Type toggle */}
        <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setType(t); setCategory(""); }}
              className={`flex-1 py-1.5 text-sm rounded-md capitalize transition-colors ${
                type === t
                  ? t === "expense" ? "bg-danger/80 text-white" : "bg-success/80 text-white"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Amount *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-base pl-7"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Category *</label>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                  category === c
                    ? "bg-accent/20 border-accent/40 text-accent-text"
                    : "border-bg-border text-text-secondary hover:border-accent/30"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Note</label>
          <input className="input-base text-sm" placeholder="Optional description..." value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-text-secondary mb-1.5 block">Date</label>
          <input type="date" className="input-base" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!amount || parseFloat(amount) <= 0 || !category || saving}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <LoadingDots /> : initial ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

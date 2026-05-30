import type { Debt, PayoffPlan, PayoffDebt } from "@/types";

const MAX_MONTHS = 600;

export function formatPayoffDuration(months: number): string {
  if (months <= 0) return "0 months";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} month${rem !== 1 ? "s" : ""}`;
  if (rem === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years} year${years !== 1 ? "s" : ""} ${rem} month${rem !== 1 ? "s" : ""}`;
}

export function calculatePayoff(
  debts: Debt[],
  method: "avalanche" | "snowball",
  extraPayment: number
): PayoffPlan {
  if (debts.length === 0) {
    const today = new Date().toISOString().split("T")[0];
    return { method, extra_monthly_payment: extraPayment, debts: [], total_interest: 0, payoff_date: today, monthly_payment: 0 };
  }

  // Sort: avalanche = highest rate first, snowball = lowest balance first
  const sorted = [...debts].sort((a, b) =>
    method === "avalanche"
      ? b.interest_rate - a.interest_rate
      : a.balance - b.balance
  );

  // Working state
  const balances = sorted.map((d) => d.balance);
  const interestAccrued = sorted.map(() => 0);
  const payoffMonths = sorted.map(() => -1);

  const totalMin = sorted.reduce((s, d) => s + d.minimum_payment, 0);

  let month = 0;
  while (month < MAX_MONTHS) {
    month++;

    // Which debts still have balance?
    const active = balances.map((b, i) => ({ i, b })).filter((x) => x.b > 0);
    if (active.length === 0) break;

    // Apply monthly interest
    active.forEach(({ i }) => {
      const monthlyRate = sorted[i].interest_rate / 12;
      interestAccrued[i] += balances[i] * monthlyRate;
      balances[i] += balances[i] * monthlyRate;
    });

    // Determine extra pool: freed-up minimums from paid debts + passed-in extra
    const freedMinimums = sorted
      .filter((_, i) => balances[i] <= 0 || payoffMonths[i] !== -1)
      .reduce((s, d) => s + d.minimum_payment, 0);
    let extra = extraPayment + freedMinimums;

    // Apply minimums to each active debt
    active.forEach(({ i }) => {
      const pay = Math.min(sorted[i].minimum_payment, balances[i]);
      balances[i] -= pay;
      if (balances[i] < 0.01) {
        extra += -balances[i]; // any overpay rolls into extra
        balances[i] = 0;
        if (payoffMonths[i] === -1) payoffMonths[i] = month;
      }
    });

    // Apply extra to focus debt (first still-active in sorted order)
    for (let i = 0; i < sorted.length && extra > 0.01; i++) {
      if (balances[i] > 0) {
        const pay = Math.min(extra, balances[i]);
        balances[i] -= pay;
        extra -= pay;
        if (balances[i] < 0.01) {
          extra += -balances[i];
          balances[i] = 0;
          if (payoffMonths[i] === -1) payoffMonths[i] = month;
        }
      }
    }
  }

  // Build results
  const today = new Date();
  const payoffDebts: PayoffDebt[] = sorted.map((d, i) => {
    const m = payoffMonths[i] > 0 ? payoffMonths[i] : MAX_MONTHS;
    const date = new Date(today);
    date.setMonth(date.getMonth() + m);
    return {
      id: d.id,
      name: d.name,
      payoff_date: date.toISOString().split("T")[0],
      total_interest: Math.round(interestAccrued[i] * 100) / 100,
      payment_order: i + 1,
    };
  });

  const lastMonth = Math.max(...payoffDebts.map((d) => {
    const ms = new Date(d.payoff_date).getTime() - today.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24 * 30));
  }));

  const finalDate = new Date(today);
  finalDate.setMonth(finalDate.getMonth() + lastMonth);

  return {
    method,
    extra_monthly_payment: extraPayment,
    debts: payoffDebts,
    total_interest: Math.round(payoffDebts.reduce((s, d) => s + d.total_interest, 0) * 100) / 100,
    payoff_date: finalDate.toISOString().split("T")[0],
    monthly_payment: totalMin + extraPayment,
  };
}

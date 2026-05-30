// Pure FIRE calculation utilities

export function calcFiNumber(annualExpenses: number, withdrawalRate: number): number {
  return annualExpenses / withdrawalRate;
}

/**
 * Iterative month-by-month compound growth projection.
 * Returns null if already FI or monthlySavings <= 0.
 * Caps at 600 months (50 years).
 */
export function calcMonthsToFi(
  currentNetWorth: number,
  fiNumber: number,
  monthlySavings: number,
  annualReturn: number
): number | null {
  if (currentNetWorth >= fiNumber) return null;
  if (monthlySavings <= 0) return null;
  const monthlyRate = annualReturn / 12;
  let nw = currentNetWorth;
  for (let m = 1; m <= 600; m++) {
    nw = nw * (1 + monthlyRate) + monthlySavings;
    if (nw >= fiNumber) return m;
  }
  return null;
}

export function formatTimeToFi(months: number | null): string {
  if (months === null) return "Already FI!";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} month${rem !== 1 ? "s" : ""}`;
  if (rem === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years} year${years !== 1 ? "s" : ""} ${rem} month${rem !== 1 ? "s" : ""}`;
}

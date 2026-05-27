/**
 * Maps Plaid's primary personal_finance_category values to human-readable labels.
 * Used by Budget, FinanceTracker, and the weekly review to normalise Plaid spend.
 */
export const PLAID_CATEGORY_LABELS: Record<string, string> = {
  INCOME:                    "Income",
  TRANSFER_IN:               "Transfer In",
  TRANSFER_OUT:              "Transfer Out",
  LOAN_PAYMENTS:             "Loan Payments",
  BANK_FEES:                 "Bank Fees",
  ENTERTAINMENT:             "Entertainment",
  FOOD_AND_DRINK:            "Food & Drink",
  GENERAL_MERCHANDISE:       "Shopping",
  HOME_IMPROVEMENT:          "Home",
  MEDICAL:                   "Medical",
  PERSONAL_CARE:             "Personal Care",
  GENERAL_SERVICES:          "Services",
  GOVERNMENT_AND_NON_PROFIT: "Government",
  TRANSPORTATION:            "Transportation",
  TRAVEL:                    "Travel",
  RENT_AND_UTILITIES:        "Utilities",
};

/** Convert a raw Plaid category string to its display label. */
export function plaidCategoryLabel(raw: string): string {
  return PLAID_CATEGORY_LABELS[raw] ?? raw;
}

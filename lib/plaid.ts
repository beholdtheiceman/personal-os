import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV } from "@/lib/env";

const config = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV as keyof typeof PlaidEnvironments] ?? PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
      "PLAID-SECRET": PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(config);

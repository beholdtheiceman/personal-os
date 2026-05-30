import { plaidClient } from "@/lib/plaid";
import { getAdminDb } from "@/lib/firebase-admin";

type AdminDb = ReturnType<typeof getAdminDb>;

export async function syncUserPlaid(
  uid: string,
  db: AdminDb,
): Promise<{ recurring_count: number; transaction_count: number }> {
  // Get all connected Plaid items for this user
  const itemsSnap = await db.collection(`users/${uid}/plaid_items`).get();
  if (itemsSnap.empty) {
    throw new Error("No connected accounts");
  }

  const allRecurring: object[] = [];
  const allTransactions: object[] = [];

  for (const itemDoc of itemsSnap.docs) {
    const { access_token, institution_name } = itemDoc.data();

    // ── Recurring transactions (subscriptions + regular bills) ──
    try {
      const recurringRes = await plaidClient.transactionsRecurringGet({
        access_token,
        options: { include_personal_finance_category: true },
      });

      const outflows = recurringRes.data.outflow_streams ?? [];

      for (const stream of outflows) {
        const doc = {
          stream_id: stream.stream_id,
          item_id: itemDoc.id,
          institution: institution_name,
          merchant_name: stream.merchant_name ?? stream.description,
          description: stream.description,
          amount: stream.average_amount?.amount ?? 0,
          currency: stream.average_amount?.iso_currency_code ?? "USD",
          frequency: stream.frequency,          // WEEKLY | BIWEEKLY | SEMI_MONTHLY | MONTHLY | ANNUALLY
          last_date: stream.last_date,
          first_date: stream.first_date,
          is_active: stream.status === "MATURE" || stream.status === "EARLY_DETECTION",
          category: stream.personal_finance_category?.primary ?? "GENERAL_MERCHANDISE",
          last_synced: new Date().toISOString(),
        };
        allRecurring.push(doc);
        await db
          .doc(`users/${uid}/plaid_recurring/${stream.stream_id}`)
          .set(doc, { merge: true });
      }
    } catch (e) {
      console.error("Recurring sync error for item", itemDoc.id, e);
    }

    // ── Recent transactions (last 30 days) ──
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
      const endDate = new Date().toISOString().slice(0, 10);

      const txRes = await plaidClient.transactionsGet({
        access_token,
        start_date: startDate,
        end_date: endDate,
        options: { count: 100, include_personal_finance_category: true },
      });

      for (const tx of txRes.data.transactions) {
        const doc = {
          transaction_id: tx.transaction_id,
          item_id: itemDoc.id,
          institution: institution_name,
          merchant_name: tx.merchant_name ?? tx.name,
          amount: tx.amount,         // positive = debit/expense, negative = credit/income
          currency: tx.iso_currency_code ?? "USD",
          date: tx.date,
          category: tx.personal_finance_category?.primary ?? "GENERAL_MERCHANDISE",
          pending: tx.pending,
          last_synced: new Date().toISOString(),
        };
        allTransactions.push(doc);
        await db
          .doc(`users/${uid}/plaid_transactions/${tx.transaction_id}`)
          .set(doc, { merge: true });
      }
    } catch (e) {
      console.error("Transaction sync error for item", itemDoc.id, e);
    }
  }

  // Update last sync timestamp
  await db.doc(`users/${uid}/settings/plaid`).set({
    last_synced: new Date().toISOString(),
    item_count: itemsSnap.size,
  }, { merge: true });

  return {
    recurring_count: allRecurring.length,
    transaction_count: allTransactions.length,
  };
}

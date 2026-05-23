"use client";
import { useState } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useMealPlan, useShoppingList, useRecipes } from "@/hooks/useMealPlanner";
import {
  RiShoppingCart2Line, RiRefreshLine, RiCheckLine, RiFileDownloadLine,
  RiGoogleLine, RiPriceTag3Line, RiCloseLine, RiStoreLine,
} from "react-icons/ri";
import type { ShoppingListItem, MealSlot } from "@/types";
import toast from "react-hot-toast";
import type { PriceCheckResult } from "@/app/api/meal-planner/price-check/route";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

const QUICK_STORES = ["Walmart", "Kroger", "Target", "Whole Foods", "Aldi", "Amazon Fresh"];

interface Props {
  weekStart: string;
}

export default function ShoppingListView({ weekStart }: Props) {
  const { user } = useAuth();
  const { plan } = useMealPlan(weekStart);
  const { list, loading } = useShoppingList(weekStart);
  const { recipes } = useRecipes();
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savingToDrive, setSavingToDrive] = useState(false);

  // Price check state
  const [showPricePanel, setShowPricePanel] = useState(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [customStore, setCustomStore] = useState("");
  const [priceChecking, setPriceChecking] = useState(false);
  const [prices, setPrices] = useState<PriceCheckResult | null>(null);

  const saveToDrive = async () => {
    if (!user || !list) return;
    setSavingToDrive(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/meal-planner/save-shopping-list-to-drive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ weekStart }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        needsReconnect?: boolean;
        webViewLink?: string;
      };

      if (!res.ok) {
        if (data.needsReconnect) {
          toast("Drive needs write access. Reconnecting…", { icon: "🔑" });
          window.location.href = `/api/drive/auth?uid=${user.uid}`;
          return;
        }
        throw new Error(data.error ?? "Save failed");
      }

      if (data.webViewLink) {
        toast.success(
          (t) => (
            <span>
              Saved to Drive —{" "}
              <a
                href={data.webViewLink}
                target="_blank"
                rel="noreferrer"
                onClick={() => toast.dismiss(t.id)}
                className="underline text-accent"
              >
                Open
              </a>
            </span>
          ),
          { duration: 8000 }
        );
      } else {
        toast.success("Saved to Drive");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save to Drive");
    } finally {
      setSavingToDrive(false);
    }
  };

  const exportToWord = async () => {
    if (!user || !list) return;
    setExporting(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(
        `/api/meal-planner/export-shopping-list?weekStart=${encodeURIComponent(weekStart)}`,
        { headers: { Authorization: `Bearer ${idToken}` } }
      );
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shopping-list-${weekStart}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export");
    } finally {
      setExporting(false);
    }
  };

  const generateList = async () => {
    if (!user || !plan) return;
    setGenerating(true);
    try {
      const recipeIds = new Set<string>();
      for (const day of Object.values(plan.days ?? {})) {
        for (const slot of SLOTS) {
          const entry = (day as Record<string, { recipe_id: string } | undefined>)[slot];
          if (entry?.recipe_id) recipeIds.add(entry.recipe_id);
        }
      }

      if (recipeIds.size === 0) {
        toast.error("No meals planned this week");
        return;
      }

      const recipeMap = new Map(recipes.map((r) => [r.id, r]));

      for (const id of recipeIds) {
        if (!recipeMap.has(id)) {
          const snap = await getDoc(doc(db, "users", user.uid, "recipes", id));
          if (snap.exists()) recipeMap.set(id, { id: snap.id, ...snap.data() } as Parameters<typeof recipeMap.set>[1]);
        }
      }

      const aggregate = new Map<string, string[]>();
      for (const id of recipeIds) {
        const recipe = recipeMap.get(id);
        if (!recipe) continue;
        for (const ing of recipe.ingredients ?? []) {
          const key = ing.name.toLowerCase().trim();
          if (!aggregate.has(key)) aggregate.set(key, []);
          aggregate.get(key)!.push(ing.amount);
        }
      }

      const items: ShoppingListItem[] = Array.from(aggregate.entries()).map(([name, amounts]) => ({
        ingredient: name,
        amount: amounts.length > 1 ? amounts.join(" + ") : amounts[0] ?? "",
        checked: false,
      }));

      await setDoc(doc(db, "users", user.uid, "shopping_lists", weekStart), {
        week_start: weekStart,
        items,
        generated_at: new Date().toISOString(),
      });
      setPrices(null); // clear stale prices on regenerate
      toast.success(`Shopping list generated — ${items.length} items`);
    } catch (err) {
      toast.error("Failed to generate list");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const toggleItem = async (index: number) => {
    if (!user || !list) return;
    const updatedItems = list.items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    await updateDoc(doc(db, "users", user.uid, "shopping_lists", weekStart), { items: updatedItems });
  };

  // ── Price check ────────────────────────────────────────────────────────────
  const toggleStore = (store: string) => {
    setSelectedStores((prev) => {
      if (prev.includes(store)) return prev.filter((s) => s !== store);
      if (prev.length >= 2) return [prev[1], store]; // max 2
      return [...prev, store];
    });
  };

  const checkPrices = async () => {
    if (!user || !list) return;
    const stores = [
      ...selectedStores,
      ...(customStore.trim() ? [customStore.trim()] : []),
    ].slice(0, 2);
    if (stores.length === 0) {
      toast.error("Select at least one store");
      return;
    }

    setPriceChecking(true);
    setPrices(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/meal-planner/price-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ weekStart, stores }),
      });
      const data = (await res.json()) as { prices?: PriceCheckResult; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Price check failed");
      setPrices(data.prices ?? null);
      setShowPricePanel(false);
      toast.success("Price estimates ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Price check failed");
    } finally {
      setPriceChecking(false);
    }
  };

  // Build price lookup maps: ingredient → price per store
  const storePriceMaps = prices
    ? Object.fromEntries(
        Object.entries(prices).map(([store, data]) => [
          store,
          new Map(data.items.map((item) => [item.ingredient.toLowerCase(), item])),
        ])
      )
    : null;

  const storeNames = storePriceMaps ? Object.keys(storePriceMaps) : [];
  const unchecked = list?.items.filter((i) => !i.checked).length ?? 0;
  const total = list?.items.length ?? 0;

  if (loading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          {list ? (
            <p className="text-sm text-text-secondary">
              <span className="text-text-primary font-medium">{unchecked}</span> of {total} items remaining
            </p>
          ) : (
            <p className="text-sm text-text-muted">Generate a list from this week&apos;s meal plan</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {list && (
            <>
              <button
                onClick={() => { setShowPricePanel((v) => !v); setPrices(null); }}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-accent/25 text-accent border border-accent/40 hover:border-accent/70 shadow-sm transition-colors"
                title="Estimate prices at a store"
              >
                <RiPriceTag3Line className="w-4 h-4" />
                Price Check
              </button>
              <button
                onClick={saveToDrive}
                disabled={savingToDrive}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-accent/25 text-accent border border-accent/40 hover:border-accent/70 shadow-sm disabled:opacity-50 transition-colors"
                title="Save as a Google Doc in your Drive"
              >
                {savingToDrive
                  ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <RiGoogleLine className="w-4 h-4" />}
                Save to Drive
              </button>
              <button
                onClick={exportToWord}
                disabled={exporting}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-accent/25 text-accent border border-accent/40 hover:border-accent/70 shadow-sm disabled:opacity-50 transition-colors"
                title="Download as a Word document"
              >
                {exporting
                  ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <RiFileDownloadLine className="w-4 h-4" />}
                Download
              </button>
            </>
          )}
          <button
            onClick={generateList}
            disabled={generating || !plan}
            className="flex items-center gap-1.5 text-sm btn-primary disabled:opacity-50"
          >
            {generating
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <RiRefreshLine className="w-4 h-4" />}
            {list ? "Regenerate" : "Generate list"}
          </button>
        </div>
      </div>

      {/* Price check panel */}
      {showPricePanel && list && (
        <div className="card border-accent/20 bg-accent/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RiStoreLine className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-text-primary">Select store(s) to price check</span>
              <span className="text-xs text-text-muted">(up to 2)</span>
            </div>
            <button
              onClick={() => setShowPricePanel(false)}
              className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
            >
              <RiCloseLine className="w-4 h-4" />
            </button>
          </div>

          {/* Quick-select store buttons */}
          <div className="flex flex-wrap gap-2">
            {QUICK_STORES.map((store) => {
              const active = selectedStores.includes(store);
              return (
                <button
                  key={store}
                  onClick={() => toggleStore(store)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? "bg-accent/20 border-accent text-accent"
                      : "bg-bg-tertiary border-bg-border text-text-secondary hover:border-accent/40"
                  }`}
                >
                  {active && <span className="mr-1">✓</span>}
                  {store}
                </button>
              );
            })}
          </div>

          {/* Custom store input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customStore}
              onChange={(e) => setCustomStore(e.target.value)}
              placeholder="Other store…"
              className="input-base text-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && checkPrices()}
            />
          </div>

          <button
            onClick={checkPrices}
            disabled={priceChecking || (selectedStores.length === 0 && !customStore.trim())}
            className="btn-primary text-sm w-full disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {priceChecking ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Searching for prices…
              </>
            ) : (
              <>
                <RiPriceTag3Line className="w-4 h-4" />
                Check Prices
              </>
            )}
          </button>

          {priceChecking && (
            <p className="text-xs text-text-muted text-center">
              Claude is searching for current prices — this takes 15–30 seconds
            </p>
          )}
        </div>
      )}

      {/* Price totals banner */}
      {prices && storeNames.length > 0 && (
        <div className={`grid gap-3 ${storeNames.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {storeNames.map((store) => (
            <div key={store} className="card border-success/20 bg-success/5 flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-text-muted font-medium uppercase tracking-wide">{store}</p>
                <p className="text-lg font-bold text-text-primary">
                  ${prices[store].total.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-text-muted">{prices[store].items.length} items estimated</p>
                <button
                  onClick={() => setPrices(null)}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!list ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <RiShoppingCart2Line className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary text-sm">
            {plan
              ? "Click \"Generate list\" to create a shopping list from this week's meals."
              : "Plan some meals first, then generate your shopping list."}
          </p>
        </div>
      ) : (
        <div className="card space-y-0">
          {/* Column headers when prices are showing */}
          {prices && storeNames.length > 0 && (
            <div className="flex items-center gap-3 px-3 pb-2 border-b border-bg-border">
              <div className="w-5 shrink-0" />
              <span className="flex-1 text-xs text-text-muted font-medium uppercase tracking-wide">Item</span>
              <span className="text-xs text-text-muted w-16 text-right">Amount</span>
              {storeNames.map((store) => (
                <span key={store} className="text-xs text-text-muted font-medium w-20 text-right truncate">{store}</span>
              ))}
            </div>
          )}

          {list.items.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No ingredients found.</p>
          ) : (
            list.items.map((item, i) => {
              const priceEntries = storePriceMaps
                ? storeNames.map((store) => {
                    const entry = storePriceMaps[store].get(item.ingredient.toLowerCase());
                    return { store, entry };
                  })
                : [];

              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors group">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleItem(i)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                      item.checked ? "bg-accent/40 border-accent/60" : "border-white/25 group-hover:border-white/40"
                    }`}
                  >
                    {item.checked && <RiCheckLine className="w-3 h-3 text-white" />}
                  </button>

                  {/* Name */}
                  <span className={`flex-1 text-sm capitalize transition-colors ${item.checked ? "line-through text-text-muted" : "text-text-primary"}`}>
                    {item.ingredient}
                  </span>

                  {/* Amount */}
                  <span className={`text-xs w-16 text-right transition-colors ${item.checked ? "text-text-muted/50" : "text-text-muted"}`}>
                    {item.amount}
                  </span>

                  {/* Price columns */}
                  {priceEntries.map(({ store, entry }) => (
                    <span
                      key={store}
                      className={`text-xs w-20 text-right font-medium tabular-nums ${
                        item.checked ? "text-text-muted/40" : entry ? "text-success" : "text-text-muted"
                      }`}
                      title={entry?.unit ?? ""}
                    >
                      {entry ? `$${entry.price.toFixed(2)}` : "—"}
                    </span>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Per-item unit notes (collapsed under the list) */}
      {prices && storeNames.length > 0 && (
        <p className="text-xs text-text-muted text-center">
          Prices are estimates based on current search results. Hover over a price to see unit info.
        </p>
      )}
    </div>
  );
}

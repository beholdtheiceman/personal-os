"use client";
import { useState } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useMealPlan, useShoppingList, useRecipes } from "@/hooks/useMealPlanner";
import { RiShoppingCart2Line, RiRefreshLine, RiCheckLine, RiFileDownloadLine, RiGoogleLine } from "react-icons/ri";
import type { ShoppingListItem, MealSlot } from "@/types";
import toast from "react-hot-toast";

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

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
          // Existing token lacks drive.file scope (or Drive isn't connected). Send them
          // through OAuth again — the auth route now requests both scopes.
          toast(
            "Drive needs write access. Reconnecting…",
            { icon: "🔑" }
          );
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
      console.error(err);
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
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const generateList = async () => {
    if (!user || !plan) return;
    setGenerating(true);
    try {
      // Collect all recipe_ids from the week
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

      // Fetch full recipes (some may not be in the hook yet if just added via Claude)
      const recipeMap = new Map(recipes.map((r) => [r.id, r]));

      // Fetch any missing ones from Firestore
      for (const id of recipeIds) {
        if (!recipeMap.has(id)) {
          const snap = await getDoc(doc(db, "users", user.uid, "recipes", id));
          if (snap.exists()) recipeMap.set(id, { id: snap.id, ...snap.data() } as Parameters<typeof recipeMap.set>[1]);
        }
      }

      // Aggregate ingredients — try to combine by name
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

  const unchecked = list?.items.filter((i) => !i.checked).length ?? 0;
  const total = list?.items.length ?? 0;

  if (loading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header + generate */}
      <div className="flex items-center justify-between">
        <div>
          {list ? (
            <p className="text-sm text-text-secondary">
              <span className="text-text-primary font-medium">{unchecked}</span> of {total} items remaining
            </p>
          ) : (
            <p className="text-sm text-text-muted">Generate a list from this week&apos;s meal plan</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {list && (
            <>
              <button
                onClick={saveToDrive}
                disabled={savingToDrive}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-accent/25 text-accent border border-accent/40 hover:border-accent/70 shadow-sm disabled:opacity-50 transition-colors"
                title="Save as a Google Doc in your Drive"
              >
                {savingToDrive ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RiGoogleLine className="w-4 h-4" />
                )}
                Save to Drive
              </button>
              <button
                onClick={exportToWord}
                disabled={exporting}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-bg-tertiary hover:bg-accent/25 text-accent border border-accent/40 hover:border-accent/70 shadow-sm disabled:opacity-50 transition-colors"
                title="Download as a Word document"
              >
                {exporting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RiFileDownloadLine className="w-4 h-4" />
                )}
                Download
              </button>
            </>
          )}
          <button
            onClick={generateList}
            disabled={generating || !plan}
            className="flex items-center gap-1.5 text-sm btn-primary disabled:opacity-50"
          >
            {generating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <RiRefreshLine className="w-4 h-4" />
            )}
            {list ? "Regenerate" : "Generate list"}
          </button>
        </div>
      </div>

      {!list ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <RiShoppingCart2Line className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary text-sm">
            {plan ? "Click \"Generate list\" to create a shopping list from this week's meals." : "Plan some meals first, then generate your shopping list."}
          </p>
        </div>
      ) : (
        <div className="card space-y-1">
          {list.items.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No ingredients found.</p>
          ) : (
            list.items.map((item, i) => (
              <button
                key={i}
                onClick={() => toggleItem(i)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors text-left group"
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                  item.checked ? "bg-accent/40 border-accent/60" : "border-white/25 group-hover:border-white/40"
                }`}>
                  {item.checked && <RiCheckLine className="w-3 h-3 text-white" />}
                </div>
                <span className={`flex-1 text-sm capitalize transition-colors ${item.checked ? "line-through text-text-muted" : "text-text-primary"}`}>
                  {item.ingredient}
                </span>
                <span className={`text-xs transition-colors ${item.checked ? "text-text-muted/50" : "text-text-muted"}`}>
                  {item.amount}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

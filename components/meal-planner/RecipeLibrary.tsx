"use client";
import { useState } from "react";
import { addDoc, updateDoc, deleteDoc, doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRecipes } from "@/hooks/useMealPlanner";
import RecipeForm from "./RecipeForm";
import { RiAddLine, RiEditLine, RiDeleteBinLine, RiTimeLine, RiFireLine, RiSearchLine } from "react-icons/ri";
import type { Recipe } from "@/types";

export default function RecipeLibrary() {
  const { user } = useAuth();
  const { recipes, loading } = useRecipes();
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Recipe | null>(null);
  const [search, setSearch]       = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);

  const handleSave = async (data: Omit<Recipe, "id" | "created_at">) => {
    if (!user) return;
    if (editing) {
      await updateDoc(doc(db, "users", user.uid, "recipes", editing.id), data as object);
    } else {
      await addDoc(collection(db, "users", user.uid, "recipes"), { ...data, created_at: new Date().toISOString() });
    }
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "recipes", id));
  };

  const filtered = recipes.filter((r) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="flex justify-center py-12"><div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input className="input-base w-full pl-9 text-sm" placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary flex items-center gap-1.5 text-sm ml-auto">
          <RiAddLine className="w-4 h-4" /> New Recipe
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <RiFireLine className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary text-sm mb-3">{search ? "No recipes match your search." : "No recipes yet — add one or ask Claude to create one."}</p>
          {!search && <button onClick={() => setShowForm(true)} className="btn-primary text-sm">Add your first recipe</button>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((recipe) => (
            <div
              key={recipe.id}
              className="card cursor-pointer"
              onClick={() => setExpanded(expanded === recipe.id ? null : recipe.id)}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">{recipe.name}</h3>
                  {recipe.description && <p className="text-xs text-text-muted mt-0.5 truncate">{recipe.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setEditing(recipe); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors">
                    <RiEditLine className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(recipe.id)} className="p-1.5 rounded-lg hover:bg-danger/20 text-text-muted hover:text-danger transition-colors">
                    <RiDeleteBinLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {(recipe.prep_time_min || recipe.cook_time_min) && (
                  <span className="flex items-center gap-1 text-xs text-text-muted">
                    <RiTimeLine className="w-3 h-3" />
                    {[recipe.prep_time_min && `${recipe.prep_time_min}m prep`, recipe.cook_time_min && `${recipe.cook_time_min}m cook`].filter(Boolean).join(" · ")}
                  </span>
                )}
                <span className="text-xs text-text-muted">{recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}</span>
                {recipe.calories_per_serving && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <RiFireLine className="w-3 h-3" />{recipe.calories_per_serving} kcal
                  </span>
                )}
                {recipe.protein_g && <span className="text-xs text-blue-400">{recipe.protein_g}g protein</span>}
              </div>

              {/* Tags */}
              {recipe.tags && recipe.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-2">
                  {recipe.tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{tag}</span>
                  ))}
                </div>
              )}

              {/* Expanded: ingredients + instructions */}
              {expanded === recipe.id && (
                <div className="mt-3 pt-3 border-t border-white/[0.08] space-y-3">
                  {recipe.ingredients.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">Ingredients</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        {recipe.ingredients.map((ing, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-text-secondary">{ing.name}</span>
                            <span className="text-text-muted">{ing.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {recipe.instructions && (
                    <div>
                      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">Instructions</p>
                      <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">{recipe.instructions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(showForm || editing) && (
        <RecipeForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

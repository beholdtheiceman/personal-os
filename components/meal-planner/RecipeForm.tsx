"use client";
import { useState } from "react";
import { RiAddLine, RiDeleteBinLine, RiCloseLine } from "react-icons/ri";
import type { Recipe, RecipeIngredient } from "@/types";

interface Props {
  initial?: Recipe;
  onSave: (data: Omit<Recipe, "id" | "created_at">) => Promise<void>;
  onClose: () => void;
}

export default function RecipeForm({ initial, onSave, onClose }: Props) {
  const [name,        setName]        = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [servings,    setServings]    = useState(initial?.servings ?? 2);
  const [prepTime,    setPrepTime]    = useState(initial?.prep_time_min ?? "");
  const [cookTime,    setCookTime]    = useState(initial?.cook_time_min ?? "");
  const [instructions,setInstructions]= useState(initial?.instructions ?? "");
  const [calories,    setCalories]    = useState(initial?.calories_per_serving ?? "");
  const [protein,     setProtein]     = useState(initial?.protein_g ?? "");
  const [carbs,       setCarbs]       = useState(initial?.carbs_g ?? "");
  const [fat,         setFat]         = useState(initial?.fat_g ?? "");
  const [tags,        setTags]        = useState(initial?.tags?.join(", ") ?? "");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    initial?.ingredients ?? [{ name: "", amount: "" }]
  );
  const [saving, setSaving] = useState(false);

  const addIngredient = () => setIngredients((p) => [...p, { name: "", amount: "" }]);
  const removeIngredient = (i: number) => setIngredients((p) => p.filter((_, idx) => idx !== i));
  const updateIngredient = (i: number, field: keyof RecipeIngredient, value: string) =>
    setIngredients((p) => p.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name:                 name.trim(),
        description:          description.trim() || undefined,
        servings:             Number(servings),
        prep_time_min:        prepTime !== "" ? Number(prepTime) : undefined,
        cook_time_min:        cookTime !== "" ? Number(cookTime) : undefined,
        ingredients:          ingredients.filter((i) => i.name.trim()),
        instructions:         instructions.trim() || undefined,
        tags:                 tags.split(",").map((t) => t.trim()).filter(Boolean),
        calories_per_serving: calories !== "" ? Number(calories) : undefined,
        protein_g:            protein  !== "" ? Number(protein)  : undefined,
        carbs_g:              carbs    !== "" ? Number(carbs)    : undefined,
        fat_g:                fat      !== "" ? Number(fat)      : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-5"
        style={{ background: "rgba(20, 8, 18, 0.96)", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{initial ? "Edit Recipe" : "New Recipe"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors">
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        {/* Name + servings */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="text-xs text-text-muted">Recipe name *</label>
            <input className="input-base w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken Tikka Masala" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Servings</label>
            <input type="number" min={1} className="input-base w-full" value={servings} onChange={(e) => setServings(Number(e.target.value))} />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs text-text-muted">Description</label>
          <input className="input-base w-full" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" />
        </div>

        {/* Prep/Cook time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Prep time (min)</label>
            <input type="number" min={0} className="input-base w-full" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="15" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Cook time (min)</label>
            <input type="number" min={0} className="input-base w-full" value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="30" />
          </div>
        </div>

        {/* Ingredients */}
        <div className="space-y-2">
          <label className="text-xs text-text-muted">Ingredients</label>
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className="input-base flex-1" value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} placeholder="Ingredient" />
              <input className="input-base w-28" value={ing.amount} onChange={(e) => updateIngredient(i, "amount", e.target.value)} placeholder="Amount" />
              <button onClick={() => removeIngredient(i)} className="p-1.5 text-text-muted hover:text-danger transition-colors shrink-0">
                <RiDeleteBinLine className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={addIngredient} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors">
            <RiAddLine className="w-4 h-4" /> Add ingredient
          </button>
        </div>

        {/* Instructions */}
        <div className="space-y-1">
          <label className="text-xs text-text-muted">Instructions</label>
          <textarea className="input-base w-full resize-none" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Step-by-step instructions (optional)" />
        </div>

        {/* Macros */}
        <div className="space-y-1">
          <label className="text-xs text-text-muted">Nutrition per serving (optional)</label>
          <div className="grid grid-cols-4 gap-2">
            {([ ["Calories", calories, setCalories], ["Protein (g)", protein, setProtein], ["Carbs (g)", carbs, setCarbs], ["Fat (g)", fat, setFat] ] as [string, string | number, (v: string) => void][]).map(([label, val, setter]) => (
              <div key={label} className="space-y-1">
                <label className="text-[10px] text-text-muted">{label}</label>
                <input type="number" min={0} className="input-base w-full" value={val as string} onChange={(e) => setter(e.target.value)} placeholder="0" />
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1">
          <label className="text-xs text-text-muted">Tags (comma separated)</label>
          <input className="input-base w-full" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="high-protein, quick, chicken" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost text-sm px-4">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="btn-primary text-sm px-4 disabled:opacity-50">
            {saving ? "Saving…" : initial ? "Save changes" : "Add recipe"}
          </button>
        </div>
      </div>
    </div>
  );
}

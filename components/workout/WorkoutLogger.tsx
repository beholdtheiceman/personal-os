"use client";
import { useState, useRef } from "react";
import { RiAddLine, RiDeleteBinLine, RiCheckLine, RiTimeLine } from "react-icons/ri";
import { useWorkout } from "@/hooks/useWorkout";
import type { WorkoutExercise, WorkoutSet, ExerciseCategory, WeightUnit } from "@/types";

const CATEGORIES: ExerciseCategory[] = ["push", "pull", "legs", "core", "cardio", "other"];

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  onChange: (s: WorkoutSet) => void;
  onRemove: () => void;
}
function SetRow({ set, index, onChange, onRemove }: SetRowProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-text-muted w-5 text-right shrink-0">{index + 1}.</span>
      <input
        type="number" min={1} placeholder="Reps"
        className="input-base w-16 py-1 px-2 text-xs"
        value={set.reps || ""}
        onChange={(e) => onChange({ ...set, reps: parseInt(e.target.value) || 0 })}
      />
      <span className="text-text-muted">×</span>
      <input
        type="number" min={0} step={2.5} placeholder="Weight"
        className="input-base w-20 py-1 px-2 text-xs"
        value={set.weight || ""}
        onChange={(e) => onChange({ ...set, weight: parseFloat(e.target.value) || 0 })}
      />
      <button
        onClick={() => onChange({ ...set, unit: set.unit === "lbs" ? "kg" : "lbs" })}
        className="text-text-muted hover:text-text-secondary text-[10px] w-8 shrink-0"
      >
        {set.unit}
      </button>
      <button onClick={onRemove} className="text-text-muted hover:text-red-400 ml-auto">
        <RiDeleteBinLine className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface ExerciseCardProps {
  we: WorkoutExercise;
  defaultUnit: WeightUnit;
  onChange: (we: WorkoutExercise) => void;
  onRemove: () => void;
}
function ExerciseCard({ we, defaultUnit, onChange, onRemove }: ExerciseCardProps) {
  const addSet = () => {
    const lastSet = we.sets[we.sets.length - 1];
    const newSet: WorkoutSet = lastSet
      ? { ...lastSet }
      : { reps: 10, weight: 0, unit: defaultUnit };
    onChange({ ...we, sets: [...we.sets, newSet] });
  };

  const updateSet = (i: number, s: WorkoutSet) => {
    const sets = [...we.sets];
    sets[i] = s;
    onChange({ ...we, sets });
  };

  const removeSet = (i: number) => {
    onChange({ ...we, sets: we.sets.filter((_, idx) => idx !== i) });
  };

  const totalVolume = we.sets.reduce((s, set) => s + set.reps * set.weight, 0);

  return (
    <div className="border border-bg-border rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-text-primary flex-1">{we.exercise_name}</span>
        {totalVolume > 0 && (
          <span className="text-[10px] text-text-muted">{totalVolume.toLocaleString()} vol</span>
        )}
        <button onClick={onRemove} className="text-text-muted hover:text-red-400">
          <RiDeleteBinLine className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        {we.sets.map((s, i) => (
          <SetRow key={i} set={s} index={i} onChange={(ns) => updateSet(i, ns)} onRemove={() => removeSet(i)} />
        ))}
      </div>

      <button
        onClick={addSet}
        className="flex items-center gap-1 text-xs text-accent hover:text-accent-text"
      >
        <RiAddLine className="w-3.5 h-3.5" /> Add set
      </button>
    </div>
  );
}

export default function WorkoutLogger() {
  const { exercises, saveSession, addExercise } = useWorkout();
  const [sessionName, setSessionName] = useState("");
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newExCategory, setNewExCategory] = useState<ExerciseCategory>("other");
  const [defaultUnit] = useState<WeightUnit>("lbs");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const filtered = search.trim()
    ? exercises.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : exercises.slice(0, 8);

  const addToSession = async (name: string, id?: string, category?: ExerciseCategory) => {
    let exerciseId = id ?? "";
    if (!id) {
      const ex = await addExercise(name, category ?? newExCategory);
      exerciseId = ex.id;
    }
    const already = workoutExercises.find((we) => we.exercise_id === exerciseId);
    if (!already) {
      setWorkoutExercises((prev) => [
        ...prev,
        { exercise_id: exerciseId, exercise_name: name, sets: [{ reps: 10, weight: 0, unit: defaultUnit }] },
      ]);
    }
    setSearch("");
    setShowSearch(false);
  };

  const handleSave = async () => {
    if (workoutExercises.length === 0) return;
    setSaving(true);
    const name = sessionName.trim() || "Workout";
    const dur = parseInt(duration) || undefined;
    await saveSession(name, workoutExercises, dur, notes);
    // Reset
    setSessionName("");
    setWorkoutExercises([]);
    setDuration("");
    setNotes("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center">
          <RiCheckLine className="w-7 h-7 text-success" />
        </div>
        <p className="text-text-primary font-semibold">Workout logged!</p>
        <button onClick={() => setSaved(false)} className="text-xs text-accent hover:text-accent-text">Log another</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="flex items-center gap-3">
        <input
          className="input-base flex-1 text-sm py-1.5 px-3"
          placeholder="Session name (e.g. Push Day A)"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
        />
        <div className="flex items-center gap-1.5">
          <RiTimeLine className="w-4 h-4 text-text-muted" />
          <input
            type="number" min={1} max={300} placeholder="min"
            className="input-base w-16 text-xs py-1.5 px-2"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>
      </div>

      {/* Exercise list */}
      {workoutExercises.length > 0 && (
        <div className="space-y-2">
          {workoutExercises.map((we, i) => (
            <ExerciseCard
              key={we.exercise_id}
              we={we}
              defaultUnit={defaultUnit}
              onChange={(updated) => setWorkoutExercises((prev) => prev.map((x, idx) => (idx === i ? updated : x)))}
              onRemove={() => setWorkoutExercises((prev) => prev.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
      )}

      {/* Add exercise */}
      <div ref={searchRef} className="relative">
        {showSearch ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                className="input-base flex-1 text-sm py-1.5 px-3"
                placeholder="Search or type new exercise…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setShowSearch(false); setSearch(""); }
                  if (e.key === "Enter" && search.trim() && filtered.length === 0) {
                    addToSession(search.trim());
                  }
                }}
                autoFocus
              />
              <button onClick={() => { setShowSearch(false); setSearch(""); }} className="text-text-muted hover:text-text-secondary text-xs px-2">Cancel</button>
            </div>

            {/* Results */}
            {filtered.length > 0 && (
              <div className="border border-bg-border rounded-xl overflow-hidden">
                {filtered.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => addToSession(ex.name, ex.id, ex.category)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-white/10 transition-colors"
                  >
                    <span className="flex-1 text-text-primary">{ex.name}</span>
                    <span className="text-[10px] text-text-muted capitalize">{ex.category}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Create new */}
            {search.trim() && !exercises.find((e) => e.name.toLowerCase() === search.toLowerCase()) && (
              <div className="flex items-center gap-2 border border-bg-border rounded-xl px-3 py-2">
                <span className="text-sm text-text-secondary flex-1">Create "{search.trim()}"</span>
                <select
                  className="input-base text-xs py-1 px-2"
                  value={newExCategory}
                  onChange={(e) => setNewExCategory(e.target.value as ExerciseCategory)}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={() => addToSession(search.trim())}
                  className="text-xs text-accent hover:text-accent-text font-medium"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-text"
          >
            <RiAddLine className="w-4 h-4" /> Add exercise
          </button>
        )}
      </div>

      {/* Notes */}
      {workoutExercises.length > 0 && (
        <textarea
          className="input-base w-full text-xs py-1.5 px-3 resize-none"
          placeholder="Session notes (optional)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      )}

      {/* Save */}
      {workoutExercises.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RiCheckLine className="w-4 h-4" />
          {saving ? "Saving…" : `Complete workout (+${50 + workoutExercises.length * 10} XP)`}
        </button>
      )}

      {workoutExercises.length === 0 && !showSearch && (
        <p className="text-sm text-text-muted text-center py-8">Add exercises to start logging your workout.</p>
      )}
    </div>
  );
}

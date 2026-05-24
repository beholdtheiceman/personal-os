"use client";
import { useState, useEffect, useCallback } from "react";
import {
  collection, onSnapshot, setDoc, doc, orderBy, query, limit, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import HealthForm from "./HealthForm";
import WeeklyChart from "./WeeklyChart";
import {
  RiEditLine, RiAddLine, RiMoonLine, RiFlashlightLine, RiRunLine,
  RiCheckLine, RiHeartPulseLine, RiLinksLine, RiRefreshLine,
} from "react-icons/ri";
import LoadingDots from "@/components/ui/LoadingDots";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useToday } from "@/hooks/useToday";
import type { HealthLog } from "@/types";

interface FitData {
  connected: boolean;
  sleep_hours: number | null;
  sleep_quality: number | null;
  sleep_efficiency: number | null;
  steps: number | null;
  resting_heart_rate: number | null;
  exercises: { name: string; duration_minutes: number | null; calories: number | null }[];
}

function StatChip({
  icon: Icon, label, value, color, sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="card flex-1 text-center space-y-1 py-4">
      <Icon className={`w-5 h-5 mx-auto ${color}`} />
      <p className="text-lg font-semibold text-text-primary">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
      {sub && <p className="text-xs text-text-muted opacity-60">{sub}</p>}
    </div>
  );
}

export default function HealthTracker() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fitData, setFitData] = useState<FitData | null>(null);
  const [fitLoading, setFitLoading] = useState(false);
  const [formPrefill, setFormPrefill] = useState<Partial<HealthLog> | undefined>();
  const today = useToday();
  const todayLog = logs.find((l) => l.date === today);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "health"),
      orderBy("date", "desc"),
      limit(14)
    );
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HealthLog)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const fetchFitData = useCallback(async () => {
    if (!user) return;
    setFitLoading(true);
    try {
      const res = await fetch(`/api/health/data?uid=${user.uid}`);
      const data: FitData = await res.json();
      setFitData(data);
    } catch {
      // silently fail — Google Fit is optional
    } finally {
      setFitLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFitData();
  }, [fetchFitData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast.success("Google Fit connected!");
      window.history.replaceState({}, "", "/health");
      fetchFitData();
    } else if (params.get("error")) {
      toast.error("Failed to connect Google Fit");
      window.history.replaceState({}, "", "/health");
    }
  }, [fetchFitData]);

  const handleConnect = () => {
    if (!user) return;
    window.location.href = `/api/health/auth?uid=${user.uid}`;
  };

  const handleDisconnect = async () => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "integrations", "google_fit"));
    setFitData(null);
    toast.success("Google Health disconnected");
  };

  const openFormWithPrefill = () => {
    if (fitData?.connected && !todayLog && (fitData.sleep_hours || fitData.steps)) {
      setFormPrefill({
        sleep_hours: fitData.sleep_hours ?? 7,
        sleep_quality: fitData.sleep_quality ?? 7,
        exercise_done: fitData.exercises.length > 0,
        exercise_description: fitData.exercises.map((e) => {
          const parts = [e.name];
          if (e.duration_minutes) parts.push(`${e.duration_minutes}min`);
          if (e.calories) parts.push(`${e.calories} cal`);
          return parts.join(" · ");
        }).join(", "),
      });
    } else {
      setFormPrefill(todayLog);
    }
    setShowForm(true);
  };

  const handleSave = async (data: {
    sleep_hours: number;
    sleep_quality: number;
    energy_level: number;
    exercise_done: boolean;
    exercise_description: string;
    notes: string;
  }) => {
    if (!user) return;
    setShowForm(false);
    try {
      await setDoc(doc(db, "users", user.uid, "health", today), {
        ...data,
        date: today,
        id: today,
        logged_at: new Date().toISOString(),
      });
      toast.success("Health log saved");
    } catch {
      toast.error("Failed to save log");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingDots /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-text-muted">{format(new Date(), "EEEE, MMMM d")}</p>
        <div className="flex items-center gap-2">
          {fitLoading ? (
            <span className="text-xs text-text-muted flex items-center gap-1.5">
              <LoadingDots /> Syncing…
            </span>
          ) : fitData?.connected ? (
            <div className="flex items-center gap-1">
              <button
                onClick={fetchFitData}
                className="btn-ghost text-xs flex items-center gap-1.5"
                title="Refresh Google Health data"
              >
                <RiRefreshLine className="w-3.5 h-3.5" /> Google Health synced
              </button>
              <button
                onClick={handleDisconnect}
                className="text-xs text-text-muted hover:text-danger transition-colors px-1"
                title="Disconnect Google Health"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="btn-ghost text-xs flex items-center gap-1.5"
            >
              <RiLinksLine className="w-3.5 h-3.5" /> Connect Google Health
            </button>
          )}
          <button
            onClick={openFormWithPrefill}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {todayLog
              ? <><RiEditLine className="w-4 h-4" /> Edit Today</>
              : <><RiAddLine className="w-4 h-4" /> Log Today</>}
          </button>
        </div>
      </div>

      {/* Google Fit sync banner */}
      {fitData?.connected && !todayLog && (fitData.sleep_hours || fitData.steps) && (
        <div className="card border-accent/30 bg-accent/5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-accent uppercase tracking-wide flex items-center gap-1.5">
              <RiHeartPulseLine className="w-3.5 h-3.5" /> Google Fit data ready
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
              {fitData.sleep_hours !== null && (
                <span>
                  <span className="text-text-primary font-medium">{fitData.sleep_hours}h</span> sleep
                  {fitData.sleep_efficiency !== null && ` · ${fitData.sleep_efficiency}% efficiency`}
                </span>
              )}
              {fitData.steps !== null && (
                <span>
                  <span className="text-text-primary font-medium">{fitData.steps.toLocaleString()}</span> steps
                </span>
              )}
              {fitData.exercises.map((e, i) => (
                <span key={i}>
                  <span className="text-text-primary font-medium">{e.name}</span>
                  {e.duration_minutes && ` · ${e.duration_minutes}min`}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={openFormWithPrefill}
            className="btn-primary text-xs shrink-0 flex items-center gap-1.5"
          >
            <RiAddLine className="w-3.5 h-3.5" /> Import & log
          </button>
        </div>
      )}

      {/* Today's stats */}
      {todayLog ? (
        <div className="flex gap-3 flex-wrap">
          <StatChip icon={RiMoonLine} label="Sleep" value={`${todayLog.sleep_hours}h`} color="text-indigo-400" />
          <StatChip icon={RiMoonLine} label="Quality" value={`${todayLog.sleep_quality}/10`} color="text-emerald-400" />
          <StatChip icon={RiFlashlightLine} label="Readiness" value={`${todayLog.readiness_score ?? todayLog.energy_level * 10}/100`} color="text-amber-400" />
          <StatChip
            icon={todayLog.exercise_done ? RiCheckLine : RiRunLine}
            label="Exercise"
            value={todayLog.exercise_done ? "Done" : "None"}
            color={todayLog.exercise_done ? "text-success" : "text-text-muted"}
          />
          {fitData?.connected && fitData.steps !== null && (
            <StatChip
              icon={RiRunLine}
              label="Steps"
              value={fitData.steps.toLocaleString()}
              color="text-blue-400"
              sub="Google Health"
            />
          )}
          {fitData?.connected && fitData.resting_heart_rate !== null && (
            <StatChip
              icon={RiHeartPulseLine}
              label="Resting HR"
              value={`${fitData.resting_heart_rate} bpm`}
              color="text-rose-400"
              sub="Google Health"
            />
          )}
        </div>
      ) : (
        <div className="card flex flex-col items-center py-10 text-center">
          <RiMoonLine className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-text-secondary text-sm mb-3">No health data logged today.</p>
          <button onClick={openFormWithPrefill} className="btn-primary text-sm">
            {fitData?.connected ? "Import from Google Fit & log" : "Log today's health"}
          </button>
        </div>
      )}

      {todayLog?.notes && (
        <div className="card">
          <p className="text-xs font-medium text-text-secondary mb-1">Notes</p>
          <p className="text-sm text-text-primary">{todayLog.notes}</p>
        </div>
      )}
      {todayLog?.exercise_done && todayLog.exercise_description && (
        <div className="card flex items-center gap-2">
          <RiRunLine className="w-4 h-4 text-success shrink-0" />
          <p className="text-sm text-text-primary">{todayLog.exercise_description}</p>
        </div>
      )}

      {logs.length > 0 && <WeeklyChart logs={logs} />}

      {showForm && (
        <HealthForm
          initial={formPrefill}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

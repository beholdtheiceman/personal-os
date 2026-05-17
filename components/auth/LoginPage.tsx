"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { FcGoogle } from "react-icons/fc";
import { RiDashboardLine } from "react-icons/ri";

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 mb-4">
            <RiDashboardLine className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Personal OS</h1>
          <p className="text-text-secondary text-sm">Your AI-powered life dashboard</p>
        </div>

        {/* Login card */}
        <div className="card">
          <p className="text-text-secondary text-sm text-center mb-6">
            Sign in to access your dashboard, tasks, habits, and AI assistant.
          </p>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-bg-tertiary hover:bg-bg-border border border-bg-border text-text-primary font-medium px-4 py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            ) : (
              <FcGoogle className="w-5 h-5" />
            )}
            {loading ? "Signing in…" : "Continue with Google"}
          </button>
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          Your data is stored privately in your own Firebase project.
        </p>
      </div>
    </div>
  );
}

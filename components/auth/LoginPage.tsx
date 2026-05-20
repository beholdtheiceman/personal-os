"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { FcGoogle } from "react-icons/fc";
import ParallaxBackground from "@/components/layout/ParallaxBackground";

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <ParallaxBackground />
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent text-white text-2xl font-semibold shadow-lg mb-5">
            P
          </div>
          <h1 className="text-4xl font-light text-text-primary tracking-tight mb-2">Personal OS</h1>
          <p className="text-text-secondary text-sm">Your AI-powered life dashboard</p>
        </div>

        {/* Glass card */}
        <div className="card">
          <p className="text-text-secondary text-sm text-center mb-5">
            Sign in to access your dashboard, tasks, habits, and AI assistant.
          </p>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white/80 hover:bg-white border border-white/70 text-text-primary font-medium px-4 py-3 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            ) : (
              <FcGoogle className="w-5 h-5" />
            )}
            {loading ? "Signing in…" : "Continue with Google"}
          </button>
        </div>

        <p className="text-center text-text-muted text-xs mt-5">
          Your data is stored privately in your own Firebase project.
        </p>
      </div>
    </div>
  );
}

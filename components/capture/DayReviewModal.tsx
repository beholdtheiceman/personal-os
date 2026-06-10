"use client";
import { useState, useEffect } from "react";
import { useDayReview } from "@/hooks/useDayReview";

export default function DayReviewModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [q1, setQ1] = useState("");
  const [q2, setQ2] = useState("");
  const [q3, setQ3] = useState("");
  const [done, setDone] = useState(false);
  const { todayReview, streak, submitReview } = useDayReview();

  useEffect(() => {
    const h = () => setIsOpen(true);
    window.addEventListener("os:open-day-review", h);
    return () => window.removeEventListener("os:open-day-review", h);
  }, []);

  useEffect(() => {
    if (todayReview) {
      setQ1(todayReview.q1);
      setQ2(todayReview.q2);
      setQ3(todayReview.q3);
      setDone(true);
    }
  }, [todayReview]);

  async function handleSubmit() {
    if (!q1.trim()) return;
    await submitReview(q1.trim(), q2.trim(), q3.trim());
    setDone(true);
  }

  function handleClose() {
    setIsOpen(false);
    if (!done) { setQ1(""); setQ2(""); setQ3(""); }
    setTimeout(() => setDone(false), 300);
  }

  if (!isOpen) return null;

  const questions = [
    { label: "What got done today?", value: q1, set: setQ1, placeholder: "Finished the proposal, went to the gym…" },
    { label: "What didn't, and why?", value: q2, set: setQ2, placeholder: "Didn't reply to Sarah — ran out of energy after 5pm…" },
    { label: "One thing to carry into tomorrow", value: q3, set: setQ3, placeholder: "Send the follow-up email first thing…" },
  ];

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            🌙 Day Review{streak > 1 ? <span style={{ marginLeft: 8, fontSize: 13, color: "#fbbf24" }}>{streak} 🔥</span> : null}
          </h2>
          <button onClick={handleClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {done ? (
          <div>
            <p style={{ color: "#4ade80", fontWeight: 500, marginBottom: 16, fontSize: 14 }}>✓ Day reviewed{streak > 1 ? ` · ${streak}-day streak` : ""}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {questions.map(({ label, value }) => (
                <div key={label}>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", margin: 0 }}>{value || "—"}</p>
                </div>
              ))}
            </div>
            <button onClick={handleClose} style={{ ...pill("rgba(255,255,255,0.12)"), marginTop: 20 }}>Done</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {questions.map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{label}</label>
                <textarea
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  rows={2}
                  style={textareaStyle}
                />
              </div>
            ))}
            <button onClick={handleSubmit} disabled={!q1.trim()} style={pill(!q1.trim() ? "rgba(167,139,250,0.35)" : "#a78bfa")}>
              Save review →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
};

const panelStyle: React.CSSProperties = {
  width: "100%", maxWidth: 520, margin: "0 16px",
  background: "rgba(18,7,15,0.96)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
  padding: 24, color: "#fff",
};

const textareaStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10, color: "#fff", fontSize: 14, padding: "9px 12px",
  resize: "vertical", outline: "none", fontFamily: "inherit",
};

function pill(bg: string): React.CSSProperties {
  return { padding: "9px 20px", borderRadius: 20, fontSize: 14, fontWeight: 500, cursor: "pointer", border: "none", background: bg, color: "#fff" };
}

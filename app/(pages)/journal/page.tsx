"use client";
import JournalManager from "@/components/journal/JournalManager";

export default function JournalPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Journal</h1>
      <p className="text-text-secondary text-sm mb-6">Voice or text entries with AI summaries and mood tracking.</p>
      <JournalManager />
    </div>
  );
}

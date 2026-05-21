"use client";
import BibleReader from "@/components/bible/BibleReader";

export default function BiblePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold text-text-primary mb-1">Bible</h1>
      <p className="text-text-secondary text-sm mb-6">
        Read any chapter from the NET Bible. Each chapter you open is logged so the chat can build reading-history suggestions over time.
      </p>
      <BibleReader />
    </div>
  );
}

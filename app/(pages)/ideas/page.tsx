import IdeasVault from "@/components/ideas/IdeasVault";

export const metadata = { title: "Ideas Vault" };

export default function IdeasPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Ideas Vault</h1>
        <p className="text-sm text-text-secondary mt-1">
          Capture raw ideas before they&apos;re ready to become projects or tasks. Triage weekly with Claude.
        </p>
      </div>
      <IdeasVault />
    </div>
  );
}

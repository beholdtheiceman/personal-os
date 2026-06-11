import SOPManager from "@/components/sops/SOPManager";

export const metadata = { title: "SOPs & Runbooks" };

export default function SOPsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">SOPs & Runbooks</h1>
        <p className="text-sm text-text-secondary mt-1">
          Named step-by-step workflows Claude can walk you through or trigger by phrase.
        </p>
      </div>
      <SOPManager />
    </div>
  );
}

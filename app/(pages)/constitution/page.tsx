import ConstitutionManager from "@/components/constitution/ConstitutionManager";

export const metadata = { title: "Personal Constitution" };

export default function ConstitutionPage() {
  return (
    <div className="p-4 md:p-6">
      <ConstitutionManager />
    </div>
  );
}

import MaintenanceManager from "@/components/maintenance/MaintenanceManager";

export const metadata = { title: "Home & Vehicle Maintenance" };

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Home & Vehicles</h1>
        <p className="text-sm text-text-secondary mt-1">
          Track maintenance intervals, warranties, and service history.
        </p>
      </div>
      <MaintenanceManager />
    </div>
  );
}

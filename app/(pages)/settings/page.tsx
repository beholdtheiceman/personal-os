import NotificationSettings from "@/components/notifications/NotificationSettings";
import TimezoneSettings from "@/components/settings/TimezoneSettings";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="text-xs text-text-secondary mt-0.5">Manage your preferences and notifications</p>
      </div>
      <TimezoneSettings />
      <NotificationSettings />
    </div>
  );
}
import SeasonManager from "@/components/season/SeasonManager";

export const metadata = { title: "Life Season" };

export default function SeasonPage() {
  return (
    <div className="p-4 md:p-6">
      <SeasonManager />
    </div>
  );
}

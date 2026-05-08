import Header from "@/components/layout/Header";

export default function CalendarLoading() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Calendrier" subtitle="Chargement du calendrier..." />
      
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full bg-card border border-border rounded-xl animate-pulse shadow-sm" />
      </div>
    </div>
  );
}

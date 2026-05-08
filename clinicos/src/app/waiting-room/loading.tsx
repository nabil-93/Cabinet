import Header from "@/components/layout/Header";

export default function WaitingRoomLoading() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Salle d'attente" subtitle="Chargement..." />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="h-32 bg-card border border-border rounded-xl animate-pulse shadow-sm" />
        
        <div className="space-y-4">
          <div className="h-4 w-32 bg-muted/60 animate-pulse rounded" />
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}

import Header from "@/components/layout/Header";

export default function PrescriptionsLoading() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Ordonnances" subtitle="Chargement..." />
      
      <div className="flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 h-full">
          <div className="lg:col-span-2 space-y-3">
             <div className="h-14 bg-card border border-border rounded-xl animate-pulse" />
             <div className="space-y-2">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse shadow-sm" />
                ))}
             </div>
          </div>
          <div className="lg:col-span-3 bg-card border border-border rounded-xl animate-pulse shadow-sm" />
        </div>
      </div>
    </div>
  );
}

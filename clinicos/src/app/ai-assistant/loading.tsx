import Header from "@/components/layout/Header";

export default function AIAssistantLoading() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Assistant IA" subtitle="Initialisation..." />
      
      <div className="flex-1 overflow-hidden p-6 flex gap-0">
        <div className="flex-1 flex flex-col space-y-4">
           <div className="h-20 w-2/3 bg-card border border-border rounded-xl animate-pulse" />
           <div className="h-16 w-1/2 bg-primary/10 rounded-xl animate-pulse self-end" />
           <div className="h-24 w-3/4 bg-card border border-border rounded-xl animate-pulse" />
           <div className="flex-1" />
           <div className="h-14 w-full bg-card border border-border rounded-xl animate-pulse" />
        </div>
        <div className="hidden xl:block w-72 border-l border-border/40 p-5 space-y-4">
           <div className="h-4 w-32 bg-muted/60 animate-pulse rounded" />
           {Array(6).fill(0).map((_, i) => (
             <div key={i} className="h-12 bg-card border border-border rounded-xl animate-pulse" />
           ))}
        </div>
      </div>
    </div>
  );
}

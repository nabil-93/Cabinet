import { TableRowSkeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/Header";

export default function AppointmentsLoading() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Rendez-vous" subtitle="Chargement de votre agenda..." />
      
      <div className="flex-1 overflow-auto p-6 space-y-5">
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="h-10 w-28 bg-card border border-border rounded-xl animate-pulse flex-shrink-0" />
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 h-12 mb-4 animate-pulse shadow-sm" />

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-border/50">
            <div className="h-4 w-32 bg-muted/60 animate-pulse rounded" />
          </div>
          <table className="w-full">
            <tbody>
              {Array(8).fill(0).map((_, i) => (
                <TableRowSkeleton key={i} cols={6} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

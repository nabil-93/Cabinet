import { StatCardSkeleton, TableRowSkeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/Header";

export default function BillingLoading() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Facturation" subtitle="Chargement des données financières..." />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-3 mb-4 animate-pulse" />

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                {Array(5).fill(0).map((_, i) => (
                  <th key={i} className="p-4"><div className="h-3 w-20 bg-muted/60 animate-pulse rounded" /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array(6).fill(0).map((_, i) => (
                <TableRowSkeleton key={i} cols={5} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

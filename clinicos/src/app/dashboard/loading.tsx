import { StatCardSkeleton, ChartSkeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/Header";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Tableau de bord" subtitle="Chargement de vos statistiques..." />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        {/* Charts and Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ChartSkeleton height={300} />
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="h-4 w-32 bg-muted/60 animate-pulse rounded" />
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted/60 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/4 bg-muted/60 animate-pulse rounded" />
                    <div className="h-2 w-1/2 bg-muted/60 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-6">
            <ChartSkeleton height={200} />
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
               <div className="h-4 w-32 bg-muted/60 animate-pulse rounded" />
               {Array(6).fill(0).map((_, i) => (
                 <div key={i} className="flex items-center justify-between">
                   <div className="h-3 w-20 bg-muted/60 animate-pulse rounded" />
                   <div className="h-3 w-12 bg-muted/60 animate-pulse rounded" />
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ChartSkeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/Header";

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Analytique" subtitle="Chargement des données..." />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ChartSkeleton height={250} />
          </div>
          <ChartSkeleton height={250} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton height={200} />
          <ChartSkeleton height={200} />
        </div>
      </div>
    </div>
  );
}

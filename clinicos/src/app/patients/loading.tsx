import { PatientCardSkeleton } from "@/components/ui/skeleton";
import Header from "@/components/layout/Header";

export default function PatientsLoading() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Patients" subtitle="Chargement de la liste des patients..." />
      
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 h-10 bg-card border border-border rounded-xl animate-pulse" />
          <div className="w-full sm:w-32 h-10 bg-card border border-border rounded-xl animate-pulse" />
          <div className="w-full sm:w-32 h-10 bg-card border border-border rounded-xl animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array(9).fill(0).map((_, i) => (
            <PatientCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

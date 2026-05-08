"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { patientsService, CreatePatientDTO, UpdatePatientDTO } from "@/services/patients.service";
import api from "@/services/api";
import { toast } from "sonner";

export const PATIENTS_KEY = ["patients"] as const;

async function syncInactivePatients() {
  try { await api.post("/patients/sync-status"); } catch {}
}

export function usePatients(search?: string, limit?: number) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: search ? [...PATIENTS_KEY, { search }] : limit ? [...PATIENTS_KEY, { limit }] : PATIENTS_KEY,
    queryFn: async () => {
      const patients = await (search ? patientsService.search(search) : patientsService.getAll(limit));
      if (!search && !limit) {
        syncInactivePatients().then(() => qc.invalidateQueries({ queryKey: PATIENTS_KEY }));
      }
      return patients;
    },
    staleTime: 30_000,
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: [...PATIENTS_KEY, id],
    queryFn: () => patientsService.getById(id),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePatientDTO) => patientsService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PATIENTS_KEY }); toast.success("Patient ajouté !"); },
    onError: () => toast.error("Erreur lors de l'ajout"),
  });
}

export function useUpdatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePatientDTO }) => patientsService.update(id, data),
    onSuccess: (updatedPatient, { id }) => {
      // Mise à jour instantanée du cache individuel
      qc.setQueryData([...PATIENTS_KEY, id], updatedPatient);
      // Mise à jour instantanée de la liste (badge statut + compteurs actif/inactif)
      qc.setQueryData<any[]>(PATIENTS_KEY, old =>
        old ? old.map(p => p.id === id ? updatedPatient : p) : old
      );
      qc.invalidateQueries({ queryKey: PATIENTS_KEY });
      toast.success("Patient mis à jour !");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patientsService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PATIENTS_KEY }); toast.success("Patient supprimé"); },
    onError: () => toast.error("Erreur lors de la suppression"),
  });
}

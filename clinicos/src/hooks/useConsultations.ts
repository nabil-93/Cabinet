"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";

export interface Consultation {
  id: string;
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  date: string;
  time: string;
  type: string;
  diagnosis?: string;
  notes?: string;
  treatment?: string;
  nextVisit?: string;
  createdAt: string;
}

export interface CreateConsultationDTO {
  patientId: string;
  doctorId?: string;
  date: string;
  time: string;
  type: string;
  diagnosis?: string;
  notes?: string;
  treatment?: string;
  nextVisit?: string;
}

const KEY = (patientId: string) => ["consultations", patientId];

export function useConsultations(patientId: string) {
  return useQuery({
    queryKey: KEY(patientId),
    queryFn: async () => {
      const res = await api.get<Consultation[]>(`/consultations?patientId=${patientId}`);
      return res.data;
    },
    enabled: !!patientId,
    staleTime: 30_000,
  });
}

export function useCreateConsultation(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateConsultationDTO) => {
      const res = await api.post<Consultation>("/consultations", data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(patientId) });
      toast.success("Rapport de consultation enregistré !");
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });
}

export function useDeleteConsultation(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/consultations/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(patientId) });
      toast.success("Rapport supprimé");
    },
  });
}

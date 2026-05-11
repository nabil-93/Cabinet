"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/services/api";
import { toast } from "sonner";

export interface PatientFile {
  id: string;
  patientId: string;
  name: string;
  originalName: string;
  mimeType: string;
  category: string;
  size: number;
  storagePath: string;
  label: string;
  notes: string | null;
  url: string;
  createdAt: string;
}

const KEY = (patientId: string) => ["patient-files", patientId];

export function usePatientFiles(patientId: string) {
  return useQuery({
    queryKey: KEY(patientId),
    queryFn: async () => {
      const res = await api.get<PatientFile[]>(`/patient-files?patientId=${patientId}`);
      return res.data;
    },
    enabled: !!patientId,
    staleTime: 30_000,
  });
}

export function useUploadPatientFile(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, label, notes }: { file: File; label?: string; notes?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("patientId", patientId);
      if (label) formData.append("label", label);
      if (notes) formData.append("notes", notes);

      const res = await api.post<PatientFile>("/patient-files", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000, // 30s for uploads
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(patientId) });
      toast.success("Fichier ajouté !");
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error || "Erreur lors de l'upload";
      toast.error(msg);
    },
  });
}

export function useDeletePatientFile(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fileId: string) => {
      await api.delete(`/patient-files/${fileId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY(patientId) });
      toast.success("Fichier supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });
}

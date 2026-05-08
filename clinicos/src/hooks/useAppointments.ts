"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentsService, CreateAppointmentDTO } from "@/services/appointments.service";
import type { AppointmentStatus } from "@/types";
import { toast } from "sonner";

export const APPOINTMENTS_KEY = ["appointments"] as const;

export function useAppointments() {
  return useQuery({
    queryKey: APPOINTMENTS_KEY,
    queryFn: appointmentsService.getAll,
    staleTime: 0,           // toujours refetcher quand la page monte
    refetchOnWindowFocus: true,
  });
}

export function useAppointmentsByDate(date: string) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, { date }],
    queryFn: () => appointmentsService.getByDate(date),
    enabled: !!date,
  });
}

export function useAppointmentsByMonth(month: string) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, { month }],
    queryFn: () => appointmentsService.getByMonth(month),
    enabled: !!month,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAppointmentDTO) => appointmentsService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: APPOINTMENTS_KEY }); toast.success("Rendez-vous créé !"); },
    onError: () => toast.error("Erreur lors de la création"),
  });
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      appointmentsService.updateStatus(id, status),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
      const labels: Record<string, string> = { confirmed: "Confirmé", pending: "En attente", completed: "Terminé", cancelled: "Annulé" };
      toast.success(`Statut : ${labels[status] || status}`);
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, time }: { id: string; date: string; time?: string }) =>
      appointmentsService.reschedule(id, date, time),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
      toast.success("Rendez-vous reporté !");
    },
    onError: () => toast.error("Erreur lors du report"),
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => appointmentsService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: APPOINTMENTS_KEY }); toast.success("Rendez-vous supprimé"); },
  });
}
